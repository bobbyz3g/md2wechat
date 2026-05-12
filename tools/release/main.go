package main

import (
	"archive/tar"
	"archive/zip"
	"compress/gzip"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
)

type target struct {
	goos      string
	goarch    string
	extension string
}

var releaseTargets = []target{
	{goos: "linux", goarch: "amd64", extension: ".tar.gz"},
	{goos: "linux", goarch: "arm64", extension: ".tar.gz"},
	{goos: "windows", goarch: "amd64", extension: ".zip"},
	{goos: "windows", goarch: "arm64", extension: ".zip"},
	{goos: "darwin", goarch: "amd64", extension: ".tar.gz"},
	{goos: "darwin", goarch: "arm64", extension: ".tar.gz"},
}

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run() error {
	if err := runCommand(nil, "npm", "--prefix", "web", "run", "build"); err != nil {
		return err
	}

	for _, target := range releaseTargets {
		if err := buildTarget(target); err != nil {
			return err
		}
	}

	return nil
}

func buildTarget(target target) error {
	releaseName := fmt.Sprintf("md2wechat-%s-%s", target.goos, target.goarch)
	outputDir := filepath.Join("release", releaseName)
	if err := os.MkdirAll(outputDir, 0o755); err != nil {
		return err
	}

	binaryName := "md2wechat"
	if target.goos == "windows" {
		binaryName += ".exe"
	}

	binaryPath := filepath.Join(outputDir, binaryName)
	env := append(os.Environ(),
		"GOOS="+target.goos,
		"GOARCH="+target.goarch,
		"CGO_ENABLED=0",
	)
	if err := runCommand(env, "go", "build", "-tags", "release", "-o", binaryPath, "./cmd/md2wechat"); err != nil {
		return err
	}

	archivePath := filepath.Join("release", releaseName+target.extension)
	if err := os.Remove(archivePath); err != nil && !os.IsNotExist(err) {
		return err
	}

	if target.extension == ".zip" {
		if err := createZip(archivePath, binaryPath, binaryName); err != nil {
			return err
		}
	} else {
		if err := createTarGzip(archivePath, binaryPath, binaryName); err != nil {
			return err
		}
	}

	fmt.Printf("Release created: %s\n", archivePath)
	return nil
}

func runCommand(env []string, name string, args ...string) error {
	command := exec.Command(name, args...)
	command.Stdout = os.Stdout
	command.Stderr = os.Stderr
	command.Stdin = os.Stdin

	if env != nil {
		command.Env = env
	}

	return command.Run()
}

func createZip(zipPath string, sourcePath string, archiveName string) error {
	if err := os.MkdirAll(filepath.Dir(zipPath), 0o755); err != nil {
		return err
	}

	zipFile, err := os.Create(zipPath)
	if err != nil {
		return err
	}
	defer zipFile.Close()

	zipWriter := zip.NewWriter(zipFile)
	defer zipWriter.Close()

	sourceFile, err := os.Open(sourcePath)
	if err != nil {
		return err
	}
	defer sourceFile.Close()

	fileInfo, err := sourceFile.Stat()
	if err != nil {
		return err
	}

	header, err := zip.FileInfoHeader(fileInfo)
	if err != nil {
		return err
	}
	header.Name = archiveName
	header.Method = zip.Deflate

	archiveFile, err := zipWriter.CreateHeader(header)
	if err != nil {
		return err
	}

	_, err = io.Copy(archiveFile, sourceFile)
	return err
}

func createTarGzip(tarGzipPath string, sourcePath string, archiveName string) error {
	if err := os.MkdirAll(filepath.Dir(tarGzipPath), 0o755); err != nil {
		return err
	}

	tarGzipFile, err := os.Create(tarGzipPath)
	if err != nil {
		return err
	}
	defer tarGzipFile.Close()

	gzipWriter := gzip.NewWriter(tarGzipFile)
	defer gzipWriter.Close()

	tarWriter := tar.NewWriter(gzipWriter)
	defer tarWriter.Close()

	sourceFile, err := os.Open(sourcePath)
	if err != nil {
		return err
	}
	defer sourceFile.Close()

	fileInfo, err := sourceFile.Stat()
	if err != nil {
		return err
	}

	header, err := tar.FileInfoHeader(fileInfo, "")
	if err != nil {
		return err
	}
	header.Name = archiveName

	if err := tarWriter.WriteHeader(header); err != nil {
		return err
	}

	_, err = io.Copy(tarWriter, sourceFile)
	return err
}

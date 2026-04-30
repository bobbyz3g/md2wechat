package main

import (
	"archive/zip"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
)

const (
	outputDir = "release/md2wechat-windows-amd64"
	exeName   = "md2wechat.exe"
	zipName   = "md2wechat-windows-amd64.zip"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run() error {
	if err := runCommand("", "npm", "--prefix", "web", "run", "build"); err != nil {
		return err
	}

	if err := os.MkdirAll(outputDir, 0o755); err != nil {
		return err
	}

	exePath := filepath.Join(outputDir, exeName)
	if err := runCommand("windows", "go", "build", "-tags", "release", "-o", exePath, "./cmd/md2wechat"); err != nil {
		return err
	}

	zipPath := filepath.Join("release", zipName)
	if err := os.Remove(zipPath); err != nil && !os.IsNotExist(err) {
		return err
	}

	if err := createZip(zipPath, exePath, exeName); err != nil {
		return err
	}

	fmt.Printf("Windows release created: %s\n", zipPath)
	return nil
}

func runCommand(targetGOOS string, name string, args ...string) error {
	command := exec.Command(name, args...)
	command.Stdout = os.Stdout
	command.Stderr = os.Stderr
	command.Stdin = os.Stdin

	if targetGOOS == "windows" {
		command.Env = append(os.Environ(), "GOOS=windows", "GOARCH=amd64", "CGO_ENABLED=0")
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

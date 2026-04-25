export type ThemeId = 'default'

export type WechatTheme = {
  id: ThemeId
  name: string
  wrapperStyle: string
  elementStyles: Record<string, string>
}

export const themes: Record<ThemeId, WechatTheme> = {
  default: {
    id: 'default',
    name: '默认',
    wrapperStyle:
      'font-size:16px;line-height:1.78;color:#24211d;font-family:-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;',
    elementStyles: {
      h1: 'margin:1.4em 0 0.8em;font-size:1.55em;line-height:1.35;font-weight:700;color:#17120d;text-align:left;',
      h2: 'margin:1.35em 0 0.75em;font-size:1.28em;line-height:1.45;font-weight:700;color:#17120d;',
      h3: 'margin:1.2em 0 0.65em;font-size:1.08em;line-height:1.5;font-weight:700;color:#17120d;',
      p: 'margin:0 0 1em;',
      a: 'color:#8f4b16;text-decoration:none;border-bottom:1px solid rgba(143,75,22,0.35);',
      blockquote:
        'margin:1.15em 0;padding:0.75em 1em;background:#f7f2ea;color:#58483b;border-radius:6px;',
      ul: 'margin:0 0 1em;padding-left:1.3em;',
      ol: 'margin:0 0 1em;padding-left:1.3em;',
      li: 'margin:0.25em 0;',
      strong: 'font-weight:700;color:#17120d;',
      em: 'font-style:italic;',
      del: 'color:#73685f;text-decoration:line-through;',
      pre: 'margin:1.1em 0;padding:1em;overflow:auto;background:#17130f;color:#f5efe5;border-radius:6px;font-size:0.9em;line-height:1.65;',
      code: 'padding:0.15em 0.35em;background:#f3eadf;color:#7a3f13;border-radius:4px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,"Liberation Mono",monospace;font-size:0.9em;',
      table:
        'width:100%;margin:1em 0;border-collapse:collapse;font-size:0.95em;',
      th: 'padding:0.55em 0.65em;background:#f3eadf;color:#17120d;font-weight:700;text-align:left;border:1px solid #e6d6c2;',
      td: 'padding:0.55em 0.65em;border:1px solid #e6d6c2;',
      hr: 'border:0;border-top:1px solid #e6d6c2;margin:1.6em 0;',
      img: 'max-width:100%;height:auto;border-radius:6px;',
    },
  },
}

export function getTheme(themeId: ThemeId = 'default'): WechatTheme {
  return themes[themeId] ?? themes.default
}

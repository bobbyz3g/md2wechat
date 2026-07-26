export type ThemeId = 'default' | 'wechat-tech'

type HeadingTag = 'h1' | 'h2' | 'h3' | 'h4' | 'h5'

export type WechatTheme = {
  id: ThemeId
  name: string
  dataTool?: string
  website?: string
  wrapperStyle: string
  elementStyles: Record<string, string>
  headingContentStyles?: Partial<Record<HeadingTag, string>>
  headingPrefixStyle?: string
  headingSuffixStyle?: string
  h2AfterStyle?: string
  listItemSectionStyle?: string
  blockquoteMarkerStyle?: string
  blockquoteParagraphStyle?: string
  codeBlockHeaderStyle?: string
  codeBlockHeaderDotStyles?: string[]
  codeBlockStyle?: string
}

export const themes: Record<ThemeId, WechatTheme> = {
  default: {
    id: 'default',
    name: '绯红',
    dataTool: 'mdnice编辑器',
    website: 'https://www.mdnice.com',
    wrapperStyle:
      "margin-top:0px;margin-bottom:0px;margin-left:0px;margin-right:0px;padding-top:0px;padding-bottom:0px;padding-left:10px;padding-right:10px;background-attachment:scroll;background-clip:border-box;background-color:rgba(0, 0, 0, 0);background-image:none;background-origin:padding-box;background-position-x:left;background-position-y:top;background-repeat:no-repeat;background-size:auto;width:auto;font-family:Optima,'Microsoft YaHei',PingFangSC-regular,serif;font-size:16px;color:rgb(0, 0, 0);line-height:1.5em;word-spacing:0em;letter-spacing:0em;word-break:break-word;overflow-wrap:break-word;text-align:left;",
    elementStyles: {
      h1: 'margin-top:30px;margin-bottom:15px;margin-left:0px;margin-right:0px;padding-top:0px;padding-bottom:0px;padding-left:0px;padding-right:0px;display:block;',
      h2: 'border-bottom-color:rgb(239, 112, 96);margin-top:30px;margin-bottom:15px;margin-left:0px;margin-right:0px;padding-top:0px;padding-bottom:0px;padding-left:0px;padding-right:0px;align-items:unset;background-attachment:scroll;background-clip:border-box;background-color:unset;background-image:none;background-origin:padding-box;background-position-x:0%;background-position-y:0%;background-repeat:no-repeat;background-size:auto;border-top-style:none;border-bottom-style:solid;border-left-style:none;border-right-style:none;border-top-width:1px;border-bottom-width:2px;border-left-width:1px;border-right-width:1px;border-top-color:rgb(0, 0, 0);border-left-color:rgb(0, 0, 0);border-right-color:rgb(0, 0, 0);border-top-left-radius:0px;border-top-right-radius:0px;border-bottom-left-radius:0px;border-bottom-right-radius:0px;box-shadow:none;display:flex;flex-direction:unset;float:unset;height:auto;justify-content:unset;line-height:1.1em;overflow-x:unset;overflow-y:unset;position:relative;text-align:left;text-shadow:none;transform:none;width:auto;-webkit-box-reflect:unset;',
      h3: 'margin-top:30px;margin-bottom:15px;margin-left:0px;margin-right:0px;padding-top:0px;padding-bottom:0px;padding-left:0px;padding-right:0px;display:block;',
      h4: 'margin-top:30px;margin-bottom:15px;margin-left:0px;margin-right:0px;padding-top:0px;padding-bottom:0px;padding-left:0px;padding-right:0px;display:block;',
      h5: 'margin-top:30px;margin-bottom:15px;margin-left:0px;margin-right:0px;padding-top:0px;padding-bottom:0px;padding-left:0px;padding-right:0px;display:block;',
      p: 'color:rgb(0, 0, 0);font-size:16px;line-height:1.8em;letter-spacing:0em;text-align:left;text-indent:0em;margin-top:0px;margin-bottom:0px;margin-left:0px;margin-right:0px;padding-top:8px;padding-bottom:8px;padding-left:0px;padding-right:0px;',
      a: 'color:rgb(239, 112, 96);text-decoration:none;',
      blockquote:
        'margin-top:20px;margin-bottom:20px;margin-left:0px;margin-right:0px;padding-top:10px;padding-bottom:10px;padding-left:20px;padding-right:10px;border-top-style:none;border-bottom-style:none;border-left-style:solid;border-right-style:none;border-top-width:3px;border-bottom-width:3px;border-left-width:3px;border-right-width:3px;border-top-color:rgba(0, 0, 0, 0.4);border-bottom-color:rgba(0, 0, 0, 0.4);border-left-color:rgb(239, 112, 96);border-right-color:rgba(0, 0, 0, 0.4);border-top-left-radius:0px;border-top-right-radius:0px;border-bottom-right-radius:0px;border-bottom-left-radius:0px;background-attachment:scroll;background-clip:border-box;background-color:rgb(255, 249, 249);background-image:none;background-origin:padding-box;background-position-x:left;background-position-y:top;background-repeat:no-repeat;background-size:auto;width:auto;height:auto;box-shadow:rgba(0, 0, 0, 0) 0px 0px 0px 0px;display:block;overflow-x:auto;overflow-y:auto;',
      ul: 'list-style-type:disc;margin-top:8px;margin-bottom:8px;margin-left:0px;margin-right:0px;padding-top:0px;padding-bottom:0px;padding-left:25px;padding-right:0px;color:rgb(0, 0, 0);',
      ol: 'list-style-type:decimal;margin-top:8px;margin-bottom:8px;margin-left:0px;margin-right:0px;padding-top:0px;padding-bottom:0px;padding-left:25px;padding-right:0px;color:rgb(0, 0, 0);',
      strong: 'color:rgb(0, 0, 0);font-weight:bold;background-attachment:scroll;background-clip:border-box;background-color:rgba(0, 0, 0, 0);background-image:none;background-origin:padding-box;background-position-x:left;background-position-y:top;background-repeat:no-repeat;background-size:auto;width:auto;height:auto;margin-top:0px;margin-bottom:0px;margin-left:0px;margin-right:0px;padding-top:0px;padding-bottom:0px;padding-left:0px;padding-right:0px;border-top-style:none;border-bottom-style:none;border-left-style:none;border-right-style:none;border-top-width:3px;border-bottom-width:3px;border-left-width:3px;border-right-width:3px;border-top-color:rgba(0, 0, 0, 0.4);border-bottom-color:rgba(0, 0, 0, 0.4);border-left-color:rgba(0, 0, 0, 0.4);border-right-color:rgba(0, 0, 0, 0.4);border-top-left-radius:0px;border-top-right-radius:0px;border-bottom-right-radius:0px;border-bottom-left-radius:0px;',
      em: 'font-style:italic;',
      del: 'color:rgb(80, 80, 80);text-decoration:line-through;',
      pre: 'border-radius:5px;box-shadow:rgba(0, 0, 0, 0.55) 0px 2px 10px;text-align:left;margin-top:10px;margin-bottom:10px;margin-left:0px;margin-right:0px;padding-top:0px;padding-bottom:0px;padding-left:0px;padding-right:0px;',
      code: "color:rgb(239, 112, 96);font-size:14px;line-height:1.8em;letter-spacing:0em;background-attachment:scroll;background-clip:border-box;background-color:transparent;background-image:none;background-origin:padding-box;background-position-x:left;background-position-y:top;background-repeat:no-repeat;background-size:auto;width:auto;height:auto;border-top-style:none;border-bottom-style:none;border-left-style:none;border-right-style:none;border-top-width:3px;border-bottom-width:3px;border-left-width:3px;border-right-width:3px;border-top-color:rgb(0, 0, 0);border-bottom-color:rgba(0, 0, 0, 0.4);border-left-color:rgba(0, 0, 0, 0.4);border-right-color:rgba(0, 0, 0, 0.4);overflow-wrap:break-word;padding-top:2px;padding-right:4px;padding-bottom:2px;padding-left:4px;border-top-left-radius:4px;border-top-right-radius:4px;border-bottom-right-radius:4px;border-bottom-left-radius:4px;margin-top:0px;margin-right:2px;margin-bottom:0px;margin-left:2px;font-family:'Operator Mono',Consolas,Monaco,Menlo,monospace;word-break:break-all;",
      table:
        'width:100%;margin-top:10px;margin-bottom:10px;margin-left:0px;margin-right:0px;border-collapse:collapse;font-size:15px;line-height:1.8em;',
      th: 'padding-top:8px;padding-bottom:8px;padding-left:8px;padding-right:8px;background-color:rgb(255, 249, 249);color:rgb(0, 0, 0);font-weight:bold;text-align:left;border:1px solid rgb(239, 235, 233);',
      td: 'padding-top:8px;padding-bottom:8px;padding-left:8px;padding-right:8px;border:1px solid rgb(239, 235, 233);',
      hr: 'border:0;border-top:1px solid rgb(239, 235, 233);margin-top:20px;margin-bottom:20px;margin-left:0px;margin-right:0px;',
      img: 'max-width:100%;height:auto;border-radius:0px;',
    },
    headingContentStyles: {
      h1: 'font-size:24px;color:rgb(0, 0, 0);line-height:1.5em;letter-spacing:0em;text-align:left;font-weight:bold;display:block;',
      h2: 'font-size:22px;color:rgb(255, 255, 255);background-color:rgb(239, 112, 96);line-height:1.5em;letter-spacing:0em;align-items:unset;background-attachment:scroll;background-clip:border-box;background-image:none;background-origin:padding-box;background-position-x:0%;background-position-y:0%;background-repeat:no-repeat;background-size:auto;border-top-style:none;border-bottom-style:none;border-left-style:none;border-right-style:none;border-top-width:1px;border-bottom-width:1px;border-left-width:1px;border-right-width:1px;border-top-color:rgb(0, 0, 0);border-bottom-color:rgb(0, 0, 0);border-left-color:rgb(0, 0, 0);border-right-color:rgb(0, 0, 0);border-top-left-radius:3px;border-top-right-radius:3px;border-bottom-left-radius:0px;border-bottom-right-radius:0px;box-shadow:none;display:inline-block;font-weight:bold;flex-direction:unset;float:unset;height:auto;justify-content:unset;margin-top:0px;margin-bottom:0px;margin-left:0px;margin-right:5px;overflow-x:unset;overflow-y:unset;padding-top:3px;padding-bottom:1px;padding-left:10px;padding-right:10px;position:relative;text-align:left;text-indent:0em;text-shadow:none;transform:none;width:auto;-webkit-box-reflect:unset;',
      h3: 'font-size:20px;color:rgb(0, 0, 0);line-height:1.5em;letter-spacing:0em;text-align:left;font-weight:bold;display:block;',
      h4: 'font-size:18px;color:rgb(0, 0, 0);line-height:1.5em;letter-spacing:0em;text-align:left;font-weight:bold;display:block;',
      h5: 'font-size:16px;color:rgb(0, 0, 0);line-height:1.5em;letter-spacing:0em;text-align:left;font-weight:bold;display:block;',
    },
    headingPrefixStyle: 'display:none;',
    headingSuffixStyle: 'display:none;',
    h2AfterStyle:
      'border-bottom-color:rgb(239, 235, 233);align-items:unset;background-attachment:scroll;background-clip:border-box;background-color:unset;background-image:none;background-origin:padding-box;background-position-x:0%;background-position-y:0%;background-repeat:no-repeat;background-size:auto;border-top-style:none;border-bottom-style:solid;border-left-style:none;border-right-style:solid;border-top-width:1px;border-bottom-width:36px;border-left-width:1px;border-right-width:20px;border-top-color:rgb(0, 0, 0);border-left-color:rgb(0, 0, 0);border-right-color:transparent;border-top-left-radius:0px;border-top-right-radius:0px;border-bottom-left-radius:0px;border-bottom-right-radius:0px;box-shadow:none;color:rgb(0, 0, 0);display:inline-block;font-size:16px;font-weight:bold;flex-direction:unset;float:unset;height:auto;justify-content:unset;letter-spacing:0px;line-height:1.1em;margin-top:0px;margin-bottom:0px;margin-left:0px;margin-right:0px;overflow-x:unset;overflow-y:unset;padding-top:0px;padding-bottom:0px;padding-left:0px;padding-right:0px;position:relative;text-align:left;text-indent:0em;text-shadow:none;transform:none;width:auto;-webkit-box-reflect:unset;',
    listItemSectionStyle:
      'margin-top:5px;margin-bottom:5px;color:rgb(1, 1, 1);font-size:16px;line-height:1.8em;letter-spacing:0em;text-align:left;font-weight:normal;',
    blockquoteMarkerStyle:
      'display:none;color:rgb(0, 0, 0);font-size:16px;line-height:1.5em;letter-spacing:0px;text-align:left;font-weight:normal;',
    blockquoteParagraphStyle:
      'text-indent:0em;padding-top:8px;padding-bottom:8px;padding-left:0px;padding-right:0px;color:rgb(0, 0, 0);font-size:15px;line-height:1.8em;letter-spacing:0px;text-align:left;font-weight:normal;margin-top:0px;margin-right:0px;margin-bottom:0px;margin-left:0px;',
    codeBlockHeaderStyle:
      'display:block;height:30px;width:100%;background-color:#282c34;margin-bottom:-7px;border-radius:5px 5px 0 0;padding-top:10px;padding-left:12px;box-sizing:border-box;',
    codeBlockHeaderDotStyles: [
      'display:inline-block;width:10px;height:10px;line-height:10px;border-radius:50%;background-color:#ff5f56;color:#ff5f56;font-size:10px;margin-right:6px;vertical-align:top;',
      'display:inline-block;width:10px;height:10px;line-height:10px;border-radius:50%;background-color:#ffbd2e;color:#ffbd2e;font-size:10px;margin-right:6px;vertical-align:top;',
      'display:inline-block;width:10px;height:10px;line-height:10px;border-radius:50%;background-color:#27c93f;color:#27c93f;font-size:10px;margin-right:6px;vertical-align:top;',
    ],
    codeBlockStyle:
      'overflow-x:auto;padding:16px;color:#abb2bf;padding-top:15px;background:#282c34;border-radius:5px;display:block;font-family:Consolas,Monaco,Menlo,monospace;font-size:12px;',
  },
  'wechat-tech': {
    id: 'wechat-tech',
    name: '青锋',
    dataTool: 'mdnice编辑器',
    website: 'https://www.mdnice.com',
    wrapperStyle:
      'max-width:100%;margin:0 auto;padding-top:10px;padding-bottom:20px;padding-left:20px;padding-right:20px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;font-size:15px;line-height:1.75em;color:#2c3e50;background-color:#fff;word-wrap:break-word;word-break:break-word;overflow-wrap:break-word;text-align:left;',
    elementStyles: {
      h1: 'font-size:26px;font-weight:700;color:#0a0a0a;line-height:1.3em;margin-top:36px;margin-bottom:24px;margin-left:0px;margin-right:0px;padding-top:0px;padding-bottom:12px;padding-left:0px;padding-right:0px;border-bottom:3px solid #4a7c59;display:block;',
      h2: 'font-size:22px;font-weight:700;color:#0a0a0a;line-height:1.3em;margin-top:32px;margin-bottom:20px;margin-left:0px;margin-right:0px;padding-top:4px;padding-bottom:4px;padding-left:16px;padding-right:0px;border-left:5px solid #00a67d;background:linear-gradient(to right,#f0f9ff 0%,transparent 100%);display:block;',
      h3: 'font-size:20px;font-weight:600;color:#2c3e50;line-height:1.4em;margin-top:28px;margin-bottom:18px;margin-left:0px;margin-right:0px;padding-top:0px;padding-bottom:0px;padding-left:12px;padding-right:0px;border-left:3px solid #00a67d;display:block;',
      h4: 'font-size:18px;font-weight:600;color:#34495e;line-height:1.4em;margin-top:24px;margin-bottom:16px;margin-left:0px;margin-right:0px;padding-top:0px;padding-bottom:0px;padding-left:0px;padding-right:0px;display:block;',
      h5: 'font-size:17px;font-weight:600;color:#34495e;line-height:1.4em;margin-top:20px;margin-bottom:14px;margin-left:0px;margin-right:0px;padding-top:0px;padding-bottom:0px;padding-left:0px;padding-right:0px;display:block;',
      h6: 'font-size:16px;font-weight:600;color:#34495e;line-height:1.4em;margin-top:18px;margin-bottom:12px;margin-left:0px;margin-right:0px;padding-top:0px;padding-bottom:0px;padding-left:0px;padding-right:0px;display:block;',
      p: 'margin-top:20px;margin-bottom:20px;margin-left:0px;margin-right:0px;padding-top:0px;padding-bottom:0px;padding-left:0px;padding-right:0px;font-size:15px;line-height:1.8em;color:#1b1b1b;text-align:left;text-indent:0em;letter-spacing:0em;',
      a: 'color:#4a7c59;text-decoration:none;border-bottom:1px solid #4a7c59;',
      blockquote:
        'margin-top:16px;margin-bottom:16px;margin-left:0px;margin-right:0px;padding-top:8px;padding-bottom:8px;padding-left:16px;padding-right:16px;background-color:#f5f9fc;border-left:3px solid #8fcfbe;color:#4c4c4c;line-height:1.5em;display:block;overflow-x:auto;overflow-y:auto;',
      ul: 'list-style-type:disc;margin-top:18px;margin-bottom:18px;margin-left:0px;margin-right:0px;padding-top:0px;padding-bottom:0px;padding-left:28px;padding-right:0px;color:#2a2a2a;',
      ol: 'list-style-type:decimal;margin-top:18px;margin-bottom:18px;margin-left:0px;margin-right:0px;padding-top:0px;padding-bottom:0px;padding-left:28px;padding-right:0px;color:#2a2a2a;',
      strong:
        'font-weight:700;color:#1b1b1b;background-color:#fff3cd;padding-top:2px;padding-bottom:2px;padding-left:4px;padding-right:4px;border-radius:8px;',
      em: 'font-style:italic;color:#666;',
      del: 'color:#666;text-decoration:line-through;',
      pre: 'margin-top:24px;margin-bottom:24px;margin-left:0px;margin-right:0px;padding-top:0px;padding-bottom:0px;padding-left:0px;padding-right:0px;border-radius:8px;box-shadow:rgba(0,0,0,0.1) 0px 2px 8px;text-align:left;',
      code: 'font-family:"Fira Code",Consolas,Monaco,"Courier New",monospace;font-size:14px;line-height:1.8em;padding-top:3px;padding-bottom:3px;padding-left:6px;padding-right:6px;background-color:#f5f9fc;color:#1B365D;border-radius:8px;font-weight:500;word-break:break-all;overflow-wrap:break-word;',
      table:
        'width:100%;margin-top:24px;margin-bottom:24px;margin-left:0px;margin-right:0px;border-collapse:collapse;font-size:15px;box-shadow:rgba(0,0,0,0.1) 0px 1px 4px;line-height:1.8em;',
      th: 'background-color:#808080;color:#fff;padding-top:12px;padding-bottom:12px;padding-left:12px;padding-right:12px;text-align:left;border:1px solid #f0f0f0;font-weight:600;',
      td: 'padding-top:12px;padding-bottom:12px;padding-left:12px;padding-right:12px;border:1px solid #e0e0e0;background-color:#fff;',
      hr: 'margin-top:36px;margin-bottom:36px;margin-left:0px;margin-right:0px;border:none;height:2px;background:linear-gradient(to right,transparent,#4a7c59,transparent);',
      img: 'max-width:100%;max-height:600px;height:auto;display:block;margin-top:24px;margin-bottom:24px;margin-left:auto;margin-right:auto;border-radius:8px;box-shadow:rgba(0,0,0,0.1) 0px 2px 8px;',
    },
    listItemSectionStyle:
      'margin-top:10px;margin-bottom:10px;color:#2a2a2a;font-size:15px;line-height:1.8em;letter-spacing:0em;text-align:left;font-weight:normal;',
    blockquoteParagraphStyle:
      'text-indent:0em;padding-top:0px;padding-bottom:0px;padding-left:0px;padding-right:0px;color:#4c4c4c;font-size:15px;line-height:1.5em;letter-spacing:0em;text-align:left;font-weight:normal;margin-top:8px;margin-right:0px;margin-bottom:8px;margin-left:0px;',
    codeBlockHeaderStyle:
      'display:block;height:30px;width:100%;background-color:#f5f9fc;margin-bottom:-7px;border-radius:8px 8px 0 0;padding-top:10px;padding-left:12px;box-sizing:border-box;border:1px solid #dce8ef;border-bottom:none;',
    codeBlockHeaderDotStyles: [
      'display:inline-block;width:10px;height:10px;line-height:10px;border-radius:50%;background-color:#ff5f56;color:#ff5f56;font-size:10px;margin-right:6px;vertical-align:top;',
      'display:inline-block;width:10px;height:10px;line-height:10px;border-radius:50%;background-color:#ffbd2e;color:#ffbd2e;font-size:10px;margin-right:6px;vertical-align:top;',
      'display:inline-block;width:10px;height:10px;line-height:10px;border-radius:50%;background-color:#27c93f;color:#27c93f;font-size:10px;margin-right:6px;vertical-align:top;',
    ],
    codeBlockStyle:
      'overflow-x:auto;padding:20px;color:#1B365D;padding-top:18px;background:#f5f9fc;border:1px solid #dce8ef;border-radius:8px;display:block;font-family:"Fira Code",Consolas,Monaco,"Courier New",monospace;font-size:14px;line-height:1.6em;',
  },
}

export const themeList = Object.values(themes).map(({ id, name }) => ({
  id,
  name,
}))

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && value in themes
}

export function getTheme(themeId: ThemeId = 'default'): WechatTheme {
  return themes[themeId] ?? themes.default
}

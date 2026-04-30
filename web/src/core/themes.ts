export type ThemeId = 'default'

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
    name: 'mdnice 默认',
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
      'overflow-x:auto;padding:16px;color:#abb2bf;padding-top:15px;background:#282c34;border-radius:5px;display:-webkit-box;font-family:Consolas,Monaco,Menlo,monospace;font-size:12px;',
  },
}

export function getTheme(themeId: ThemeId = 'default'): WechatTheme {
  return themes[themeId] ?? themes.default
}

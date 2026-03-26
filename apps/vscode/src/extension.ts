// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode'
import * as crypto from 'crypto'

// WebviewPanel 管理类
class ChatPanel {
  public static currentPanel: ChatPanel | undefined
  public static readonly viewType = 'typewordsChat'

  private readonly _panel: vscode.WebviewPanel
  private readonly _extensionUri: vscode.Uri
  private _disposables: vscode.Disposable[] = []

  public static createOrShow(extensionUri: vscode.Uri) {
    // 如果已经有面板，直接显示
    if (ChatPanel.currentPanel) {
      ChatPanel.currentPanel._panel.reveal(vscode.ViewColumn.Beside)
      return
    }

    // 创建新面板，放在右侧（使用 ViewColumn.Beside 确保在右侧）
    const panel = vscode.window.createWebviewPanel(ChatPanel.viewType, 'New Agent', vscode.ViewColumn.Beside, {
      enableScripts: true,
      localResourceRoots: [],
      retainContextWhenHidden: true,
    })

    ChatPanel.currentPanel = new ChatPanel(panel, extensionUri)
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel
    this._extensionUri = extensionUri

    // 设置初始 HTML
    this._update().catch(err => {
      vscode.window.showErrorMessage(`TypeWords: Failed to load webview: ${err?.message ?? err}`)
    })

    // 监听面板关闭事件
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables)
  }

  public dispose() {
    ChatPanel.currentPanel = undefined

    // 清理资源
    this._panel.dispose()

    while (this._disposables.length) {
      const x = this._disposables.pop()
      if (x) {
        x.dispose()
      }
    }
  }

  private async _update() {
    const webview = this._panel.webview
    this._panel.webview.html = await this._getHtmlForWebview(webview)
  }

  private async _getHtmlForWebview(webview: vscode.Webview) {
    const cdnUrl = 'https://vs.typewords.cc'
    const fileUrl = 'https://files.typewords.cc'

    let r: any
    try {
      let s = await fetch('https://vs.typewords.cc/vs.json')
      r = await s.json()
    } catch (err: any) {
      vscode.window.showErrorMessage(`TypeWords: Failed to fetch webview assets: ${err?.message ?? err}`)
      return `<!DOCTYPE html><html><body><p>Failed to load TypeWords. Please check your network connection.</p></body></html>`
    }

    // 生成 nonce 用于 CSP
    const nonce = crypto.randomBytes(16).toString('hex')

    // CSP 配置：允许内联脚本（使用 nonce）和外部资源
    const csp = [
      "default-src 'none'",
      `script-src 'nonce-${nonce}' ${cdnUrl}`,
      `style-src ${cdnUrl} 'unsafe-inline'`,
      `connect-src ${cdnUrl} ${fileUrl} https://*.supabase.co`,
      'img-src data: https:',
      'media-src https://dict.youdao.com',
      'font-src data:',
    ].join('; ')

    return `<!DOCTYPE html>
<html lang="zh-CN" style="width: 100%!important; height: 100%!important;">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="${csp}">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>New Agent</title>


  <script type="module" nonce="${nonce}" src="${cdnUrl}/${r.js}"></script>
  <link rel="stylesheet" href="${cdnUrl}/${r.css}">
</head>
<body>
    <div id="app"></div>
</body>
</html>`
  }
}

export async function activate(context: vscode.ExtensionContext) {
  const openChatDisposable = vscode.commands.registerCommand('typewords.openChat', () => {
    ChatPanel.createOrShow(context.extensionUri)
  })
  context.subscriptions.push(openChatDisposable)
}

// This method is called when your extension is deactivated
export function deactivate() {}

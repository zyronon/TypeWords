// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode'

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
    this._update()

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

  private _update() {
    this._panel.webview.html = this._getHtmlForWebview()
  }

  private _getHtmlForWebview() {
    const cdnUrl = 'https://typewords.cc'

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; frame-src ${cdnUrl}; style-src 'unsafe-inline';">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TypeWords</title>
    <style>
      html, body, iframe {
        width: 100%;
        height: 100%;
        margin: 0;
        padding: 0;
        border: 0;
        overflow: hidden;
      }
    </style>
</head>
<body>
    <iframe src="${cdnUrl}/words" title="TypeWords"></iframe>
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

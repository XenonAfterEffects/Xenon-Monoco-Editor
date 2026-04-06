# Xenon Monaco WebView2 Setup

This project is fully offline and expects Monaco at:

`./min/vs/`

The folder has already been populated from `monaco-editor` package files.

## Files

- `index.html`
- `assets/styles.css`
- `assets/editor.js`
- `min/vs/*` (Monaco runtime)

## WebView2 WinForms Example

```csharp
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using System;
using System.IO;
using System.Windows.Forms;

public partial class MainForm : Form
{
    public MainForm()
    {
        InitializeComponent();
        _ = InitWebViewAsync();
    }

    private async System.Threading.Tasks.Task InitWebViewAsync()
    {
        await webView21.EnsureCoreWebView2Async();

        string appFolder = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "EditorUi");
        webView21.CoreWebView2.SetVirtualHostNameToFolderMapping(
            "appassets",
            appFolder,
            CoreWebView2HostResourceAccessKind.Allow
        );

        webView21.CoreWebView2.Navigate("https://appassets/index.html");
    }

    private async System.Threading.Tasks.Task SetLuaCodeAsync(string text)
    {
        string jsArg = System.Text.Json.JsonSerializer.Serialize(text);
        await webView21.ExecuteScriptAsync($"setCode({jsArg});");
    }

    private async System.Threading.Tasks.Task<string> GetLuaCodeAsync()
    {
        // WebView2 returns JSON string encoded response.
        string jsonResult = await webView21.ExecuteScriptAsync("getCode();");
        return System.Text.Json.JsonSerializer.Deserialize<string>(jsonResult) ?? "";
    }
}
```

## Exposed JS Functions

- `setCode(text)`
- `getCode()`
- `clearCode()`
- `appendCode(text)`

## Notes

- The editor dispatches a browser event when ready:
  - `xenon-monaco-ready`
- Optional readiness check:
  - `isEditorReady()`

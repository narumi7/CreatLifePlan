// ファイルの保存。claude.ai のアーティファクト内では downloads 機能（保存確認ダイアログ）を使い、
// 通常のブラウザではリンクのダウンロードで保存する。どちらもデータを外部に送信しない。

export type SaveResult = 'saved' | 'declined';

interface DownloadsApi {
  save(req: { filename: string; data: Blob | string }): Promise<unknown>;
}
interface ClaudeHost {
  use(name: 'downloads'): Promise<DownloadsApi | null>;
}

function anchorDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function saveFile(data: BlobPart, filename: string, type: string): Promise<SaveResult> {
  const blob = new Blob([data], { type });
  const host = (window as unknown as { claude?: ClaudeHost }).claude;
  if (host?.use) {
    const downloads = await host.use('downloads').catch(() => null);
    if (downloads) {
      try {
        await downloads.save({ filename, data: blob });
        return 'saved';
      } catch (e) {
        const code = (e as { code?: string }).code;
        if (code === 'declined') return 'declined';
        if (code === 'rate_limited') throw new Error('保存の確認画面がすでに開いています。そちらで操作してください。');
        throw new Error('この画面ではファイルを保存できません。');
      }
    }
  }
  anchorDownload(blob, filename);
  return 'saved';
}

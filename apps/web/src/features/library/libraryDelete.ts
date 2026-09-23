/** Confirm copy for content-library deletes (in-app dialog; not window.confirm). */

export function deleteModuleConfirmMessage(title: string): string {
  return `确定删除模块「${title}」？\n\n简历上已拖入的条目会保留快照，不会随库删除而消失。`;
}

export function deleteProfileConfirmMessage(
  name: string,
  isApplied: boolean,
): string {
  const appliedNote = isApplied
    ? '\n\n该卡正在应用于当前简历，删除后简历基本信息将清空。'
    : '';
  return `确定删除基本信息卡「${name}」？${appliedNote}`;
}

export function deleteModuleConfirmTitle(): string {
  return '删除模块';
}

export function deleteProfileConfirmTitle(): string {
  return '删除基本信息';
}

/**
 * Prevent HTML5 drag on the parent card from swallowing button clicks
 * (common WKWebView / Chromium failure mode for 删除).
 */
export function stopCardActionPointer(
  e: Pick<Event, 'stopPropagation'> & { preventDefault?: () => void },
): void {
  e.stopPropagation();
}

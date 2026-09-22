/** Confirm copy for content-library deletes (browser confirm). */

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

export function confirmDeleteModule(title: string): boolean {
  return window.confirm(deleteModuleConfirmMessage(title));
}

export function confirmDeleteProfile(
  name: string,
  isApplied: boolean,
): boolean {
  return window.confirm(deleteProfileConfirmMessage(name, isApplied));
}

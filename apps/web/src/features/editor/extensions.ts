import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import type { SectionId } from '@resume/domain';
import { ResumeMetaView } from './nodes/ResumeMetaView';
import { ResumeSectionView } from './nodes/ResumeSectionView';
import { PlacementItemView } from './nodes/PlacementItemView';
import { ProfileBasicView } from './nodes/ProfileBasicView';
import { ProfileEducationView } from './nodes/ProfileEducationView';
import { DropHintView } from './nodes/DropHintView';

export interface ResumeEditorCallbacks {
  onDropModule?: (section: SectionId, moduleId: string) => void | Promise<void>;
  onDeletePlacement?: (placementId: string) => void | Promise<void>;
  onMovePlacement?: (
    section: SectionId,
    placementId: string,
    direction: 'up' | 'down',
  ) => void | Promise<void>;
  /** Current ordered placement ids per section (for enable/disable move buttons). */
  getSectionPlacementIds?: (section: SectionId) => string[];
  onStatus?: (message: string) => void;
}

export const ResumeMeta = Node.create({
  name: 'resumeMeta',
  group: 'block',
  atom: true,
  selectable: false,
  addAttributes() {
    return {
      templateId: { default: 'default-v1' },
      title: { default: '未命名简历' },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="resume-meta"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-type': 'resume-meta' }),
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(ResumeMetaView);
  },
});

export const ResumeSection = Node.create<ResumeEditorCallbacks>({
  name: 'resumeSection',
  group: 'block',
  content: 'block*',
  defining: true,
  isolating: true,
  addOptions() {
    return {
      onDropModule: undefined,
      onStatus: undefined,
    };
  },
  addAttributes() {
    return {
      sectionId: { default: 'skills' },
      label: { default: '' },
      placeable: { default: false },
    };
  },
  parseHTML() {
    return [{ tag: 'section[data-type="resume-section"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'section',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'resume-section',
        'data-section': HTMLAttributes.sectionId,
      }),
      0,
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(ResumeSectionView);
  },
});

export const PlacementItem = Node.create<ResumeEditorCallbacks>({
  name: 'placementItem',
  group: 'block',
  atom: true,
  selectable: false,
  addOptions() {
    return {
      onDeletePlacement: undefined,
      onMovePlacement: undefined,
      getSectionPlacementIds: undefined,
      onStatus: undefined,
    };
  },
  addAttributes() {
    return {
      placementId: { default: '' },
      sectionId: { default: 'skills' },
      title: { default: '' },
      subtitle: { default: '' },
      projectType: { default: '' },
      timeRange: { default: '' },
      body: { default: '' },
    };
  },
  parseHTML() {
    return [{ tag: 'article[data-type="placement-item"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'article',
      mergeAttributes(HTMLAttributes, { 'data-type': 'placement-item' }),
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(PlacementItemView);
  },
});

export const ProfileBasic = Node.create({
  name: 'profileBasic',
  group: 'block',
  atom: true,
  selectable: false,
  addAttributes() {
    return {
      name: { default: '' },
      contact: { default: '' },
      summary: { default: '' },
      loading: { default: false },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="profile-basic"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-type': 'profile-basic' }),
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(ProfileBasicView);
  },
});

export const ProfileEducation = Node.create({
  name: 'profileEducation',
  group: 'block',
  atom: true,
  selectable: false,
  addAttributes() {
    return {
      linesJson: { default: '[]' },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="profile-education"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-type': 'profile-education' }),
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(ProfileEducationView);
  },
});

export const DropHint = Node.create({
  name: 'dropHint',
  group: 'block',
  atom: true,
  selectable: false,
  addAttributes() {
    return {
      empty: { default: true },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="drop-hint"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-type': 'drop-hint' }),
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(DropHintView);
  },
});

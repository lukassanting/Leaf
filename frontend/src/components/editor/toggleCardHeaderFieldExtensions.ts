import { Document } from '@tiptap/extension-document'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import TextStyle from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import TextAlign from '@tiptap/extension-text-align'
import { Extension } from '@tiptap/core'
import { StoryTag } from '@/components/editor/storyTagExtension'

const SingleParagraphDoc = Document.extend({
  content: 'paragraph',
})

/** Enter → line break inside the one paragraph (no second block). */
const ToggleHeaderSingleLine = Extension.create({
  name: 'toggleHeaderSingleLine',
  addKeyboardShortcuts() {
    return {
      Enter: () => this.editor.commands.setHardBreak(),
    }
  },
})

export function toggleCardHeaderFieldExtensions(placeholder: string) {
  return [
    SingleParagraphDoc,
    StarterKit.configure({
      document: false,
      heading: false,
      bulletList: false,
      orderedList: false,
      listItem: false,
      codeBlock: false,
      blockquote: false,
      horizontalRule: false,
      dropcursor: false,
      gapcursor: false,
    }),
    StoryTag,
    TextStyle,
    Color.configure({ types: ['textStyle'] }),
    TextAlign.configure({ types: ['paragraph'] }),
    ToggleHeaderSingleLine,
    Placeholder.configure({
      placeholder,
      showOnlyWhenEditable: true,
      showOnlyCurrent: false,
    }),
  ]
}

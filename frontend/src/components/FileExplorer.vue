<script setup lang="ts">
import { ref, computed } from 'vue'
import { useProjectStore, type FileTreeNode } from '@/stores/project'

const projectStore = useProjectStore()

const emit = defineEmits<{
  selectFile: [path: string]
  newFile: [folderPath: string]
  newFolder: [parentPath: string]
  deleteFile: [path: string]
  deleteFolder: [path: string]
  renameFile: [path: string]
}>()

// Context menu state
const contextMenu = ref<{
  show: boolean
  x: number
  y: number
  type: 'file' | 'folder' | 'root'
  path: string
  isMain: boolean
}>({
  show: false,
  x: 0,
  y: 0,
  type: 'root',
  path: '',
  isMain: false,
})

// Rename state
const renaming = ref<{ path: string; newName: string } | null>(null)
const renameInput = ref<HTMLInputElement | null>(null)

function getFileIcon(filename: string): { letter: string; color: string } {
  if (filename.endsWith('.hpp') || filename.endsWith('.h')) {
    return { letter: 'H', color: 'text-purple-400' }
  }
  if (filename.endsWith('.preset')) {
    return { letter: 'P', color: 'text-green-400' }
  }
  if (filename.endsWith('.synthSequence')) {
    return { letter: 'S', color: 'text-yellow-400' }
  }
  if (filename.endsWith('.obj')) {
    return { letter: 'O', color: 'text-amber-400' }
  }
  return { letter: 'C', color: 'text-blue-400' }
}

function handleFileClick(node: FileTreeNode) {
  if (node.type === 'file') {
    emit('selectFile', node.path)
  } else {
    projectStore.toggleFolderExpanded(node.path)
  }
}

function handleContextMenu(e: MouseEvent, node?: FileTreeNode) {
  e.preventDefault()
  e.stopPropagation()

  contextMenu.value = {
    show: true,
    x: e.clientX,
    y: e.clientY,
    type: node?.type || 'root',
    path: node?.path || '',
    isMain: node?.isMain || false,
  }
}

function closeContextMenu() {
  contextMenu.value.show = false
}

function handleNewFile() {
  const folderPath = contextMenu.value.type === 'folder' ? contextMenu.value.path : ''
  emit('newFile', folderPath)
  closeContextMenu()
}

function handleNewFolder() {
  const parentPath = contextMenu.value.type === 'folder' ? contextMenu.value.path : ''
  emit('newFolder', parentPath)
  closeContextMenu()
}

function handleDelete() {
  if (contextMenu.value.type === 'file') {
    emit('deleteFile', contextMenu.value.path)
  } else if (contextMenu.value.type === 'folder') {
    emit('deleteFolder', contextMenu.value.path)
  }
  closeContextMenu()
}

function handleRename() {
  const path = contextMenu.value.path
  const name = path.includes('/') ? path.substring(path.lastIndexOf('/') + 1) : path
  renaming.value = { path, newName: name }
  closeContextMenu()
  // Focus input after render
  setTimeout(() => renameInput.value?.focus(), 0)
}

function submitRename() {
  if (renaming.value && renaming.value.newName.trim()) {
    projectStore.renameFile(renaming.value.path, renaming.value.newName.trim())
  }
  renaming.value = null
}

function cancelRename() {
  renaming.value = null
}

// Close context menu on click outside
function handleClickOutside(e: MouseEvent) {
  if (contextMenu.value.show) {
    closeContextMenu()
  }
}
</script>

<template>
  <div
    class="h-full flex flex-col bg-editor-sidebar border-r border-editor-border select-none"
    :class="projectStore.isExplorerCollapsed ? 'w-10' : 'w-56'"
    @click="handleClickOutside"
  >
    <!-- Header -->
    <div class="h-8 flex items-center justify-between px-2 border-b border-editor-border shrink-0">
      <template v-if="!projectStore.isExplorerCollapsed">
        <span class="text-xs font-medium text-gray-400 uppercase tracking-wider">Explorer</span>
        <div class="flex items-center gap-1">
          <!-- New File -->
          <button
            @click.stop="emit('newFile', '')"
            class="p-1 hover:bg-editor-active rounded text-gray-400 hover:text-white"
            title="New File"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </button>
          <!-- New Folder -->
          <button
            @click.stop="emit('newFolder', '')"
            class="p-1 hover:bg-editor-active rounded text-gray-400 hover:text-white"
            title="New Folder"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            </svg>
          </button>
          <!-- Collapse -->
          <button
            @click="projectStore.toggleExplorer"
            class="p-1 hover:bg-editor-active rounded text-gray-400 hover:text-white"
            title="Collapse Explorer"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        </div>
      </template>
      <template v-else>
        <button
          @click="projectStore.toggleExplorer"
          class="p-1 hover:bg-editor-active rounded text-gray-400 hover:text-white mx-auto"
          title="Expand Explorer"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
        </button>
      </template>
    </div>

    <!-- File Tree -->
    <div
      v-if="!projectStore.isExplorerCollapsed"
      class="flex-1 overflow-y-auto overflow-x-hidden py-1"
      @contextmenu="handleContextMenu($event)"
    >
      <!-- Project Name -->
      <div class="px-2 py-1 text-xs font-medium text-gray-300 flex items-center gap-1">
        <svg class="w-3.5 h-3.5 text-allolib-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
        {{ projectStore.project.name }}
      </div>

      <!-- Tree Nodes -->
      <div class="pl-2">
        <template v-for="node in projectStore.fileTree" :key="node.path">
          <TreeNode
            :node="node"
            :depth="0"
            :active-path="projectStore.activeFileName"
            :renaming="renaming"
            @click="handleFileClick"
            @contextmenu="handleContextMenu"
            @rename-submit="submitRename"
            @rename-cancel="cancelRename"
            @rename-input="(val) => renaming && (renaming.newName = val)"
          />
        </template>
      </div>

      <!-- Empty state -->
      <div v-if="projectStore.fileTree.length === 0" class="px-3 py-4 text-xs text-gray-500 text-center">
        Right-click to add files
      </div>
    </div>

    <!-- Context Menu -->
    <Teleport to="body">
      <div
        v-if="contextMenu.show"
        class="fixed bg-editor-bg border border-editor-border rounded shadow-xl py-1 z-50 min-w-40"
        :style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }"
        @click.stop
      >
        <button
          @click="handleNewFile"
          class="w-full px-3 py-1.5 text-left text-sm text-gray-300 hover:bg-editor-active flex items-center gap-2"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          New File
        </button>
        <button
          @click="handleNewFolder"
          class="w-full px-3 py-1.5 text-left text-sm text-gray-300 hover:bg-editor-active flex items-center gap-2"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          </svg>
          New Folder
        </button>

        <template v-if="contextMenu.type !== 'root'">
          <div class="h-px bg-editor-border my-1"></div>

          <button
            @click="handleRename"
            class="w-full px-3 py-1.5 text-left text-sm text-gray-300 hover:bg-editor-active flex items-center gap-2"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Rename
          </button>

          <button
            v-if="!contextMenu.isMain"
            @click="handleDelete"
            class="w-full px-3 py-1.5 text-left text-sm text-red-400 hover:bg-editor-active flex items-center gap-2"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete
          </button>
        </template>
      </div>
    </Teleport>
  </div>
</template>

<script lang="ts">
// TreeNode subcomponent
import { defineComponent, h, ref } from 'vue'
import type { PropType } from 'vue'
import type { FileTreeNode } from '@/stores/project'

const TreeNode = defineComponent({
  name: 'TreeNode',
  props: {
    node: {
      type: Object as PropType<FileTreeNode>,
      required: true,
    },
    depth: {
      type: Number,
      default: 0,
    },
    activePath: {
      type: String,
      default: '',
    },
    renaming: {
      type: Object as PropType<{ path: string; newName: string } | null>,
      default: null,
    },
  },
  emits: ['click', 'contextmenu', 'rename-submit', 'rename-cancel', 'rename-input'],
  setup(props, { emit }) {
    const inputRef = ref<HTMLInputElement | null>(null)

    const getFileIcon = (filename: string) => {
      if (filename.endsWith('.hpp') || filename.endsWith('.h')) {
        return { letter: 'H', color: 'text-purple-400' }
      }
      if (filename.endsWith('.preset')) {
        return { letter: 'P', color: 'text-green-400' }
      }
      if (filename.endsWith('.synthSequence')) {
        return { letter: 'S', color: 'text-yellow-400' }
      }
      if (filename.endsWith('.obj')) {
        return { letter: 'O', color: 'text-amber-400' }
      }
      return { letter: 'C', color: 'text-blue-400' }
    }

    return () => {
      const node = props.node
      const isActive = node.path === props.activePath
      const isRenaming = props.renaming?.path === node.path
      const paddingLeft = `${props.depth * 12 + 4}px`

      // Render file or folder
      const content = []

      if (node.type === 'folder') {
        // Folder chevron
        content.push(
          h('svg', {
            class: ['w-3 h-3 text-gray-500 transition-transform', node.isExpanded ? 'rotate-90' : ''],
            fill: 'none',
            stroke: 'currentColor',
            viewBox: '0 0 24 24',
          }, [
            h('path', {
              'stroke-linecap': 'round',
              'stroke-linejoin': 'round',
              'stroke-width': '2',
              d: 'M9 5l7 7-7 7',
            }),
          ])
        )
        // Folder icon
        content.push(
          h('svg', {
            class: 'w-4 h-4 text-yellow-500',
            fill: 'currentColor',
            viewBox: '0 0 20 20',
          }, [
            h('path', {
              d: 'M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z',
            }),
          ])
        )
      } else {
        // File icon
        const icon = getFileIcon(node.name)
        content.push(
          h('span', { class: ['text-xs font-bold ml-3', icon.color] }, icon.letter)
        )
      }

      // Name or rename input
      if (isRenaming) {
        content.push(
          h('input', {
            ref: inputRef,
            type: 'text',
            value: props.renaming?.newName,
            class: 'flex-1 px-1 py-0 text-sm bg-editor-active border border-allolib-blue rounded text-white outline-none',
            onInput: (e: Event) => emit('rename-input', (e.target as HTMLInputElement).value),
            onKeydown: (e: KeyboardEvent) => {
              if (e.key === 'Enter') emit('rename-submit')
              if (e.key === 'Escape') emit('rename-cancel')
            },
            onBlur: () => emit('rename-submit'),
            onClick: (e: Event) => e.stopPropagation(),
          })
        )
      } else {
        content.push(
          h('span', { class: 'text-sm truncate' }, node.name)
        )
        // Dirty indicator
        if (node.isDirty) {
          content.push(
            h('span', { class: 'text-yellow-400 text-xs ml-1' }, '●')
          )
        }
      }

      const isSynthSequence = node.type === 'file' && node.name.endsWith('.synthSequence')

      const nodeEl = h('div', {
        class: [
          'flex items-center gap-1.5 py-0.5 px-1 cursor-pointer rounded-sm',
          'hover:bg-editor-active',
          isActive && node.type === 'file' ? 'bg-editor-active text-white' : 'text-gray-300',
        ],
        style: { paddingLeft },
        draggable: isSynthSequence ? 'true' : undefined,
        onClick: () => emit('click', node),
        onContextmenu: (e: MouseEvent) => emit('contextmenu', e, node),
        onDragstart: isSynthSequence
          ? (e: DragEvent) => {
              e.dataTransfer?.setData('application/x-synthsequence-path', node.path)
              if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copyMove'
            }
          : undefined,
      }, content)

      // Children for folders
      if (node.type === 'folder' && node.isExpanded && node.children?.length) {
        const children = node.children.map(child =>
          h(TreeNode, {
            node: child,
            depth: props.depth + 1,
            activePath: props.activePath,
            renaming: props.renaming,
            onClick: (n: FileTreeNode) => emit('click', n),
            onContextmenu: (e: MouseEvent, n: FileTreeNode) => emit('contextmenu', e, n),
            onRenameSubmit: () => emit('rename-submit'),
            onRenameCancel: () => emit('rename-cancel'),
            onRenameInput: (val: string) => emit('rename-input', val),
          })
        )
        return h('div', {}, [nodeEl, ...children])
      }

      return nodeEl
    }
  },
})

export { TreeNode }
</script>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import referenceData from '@/data/terminal-reference.json'

interface Flag {
  flag: string
  description: string
}

interface Command {
  name: string
  syntax: string
  description: string
  flags?: Flag[]
  examples?: string[]
}

interface Category {
  name: string
  icon: string
  commands: Command[]
}

interface UserCommand {
  name: string
  syntax: string
  description: string
  examples?: string[]
  category?: string
}

// State
const searchQuery = ref('')
const expandedCategories = ref<Set<string>>(new Set())
const showAddForm = ref(false)
const editingCommand = ref<UserCommand | null>(null)

// Form state for adding/editing
const formName = ref('')
const formSyntax = ref('')
const formDescription = ref('')
const formExamples = ref('')
const formCategory = ref('')

// Load user commands from localStorage
const userCommands = ref<UserCommand[]>([])

function loadUserCommands() {
  try {
    const saved = localStorage.getItem('alloterm-reference-custom')
    if (saved) {
      userCommands.value = JSON.parse(saved)
    }
  } catch { /* ignore */ }
}

function saveUserCommands() {
  try {
    localStorage.setItem('alloterm-reference-custom', JSON.stringify(userCommands.value))
  } catch { /* ignore */ }
}

onMounted(() => {
  loadUserCommands()
  // Expand first category by default
  if (referenceData.categories.length > 0) {
    expandedCategories.value.add(referenceData.categories[0].name)
  }
})

// Categories with user commands merged
const allCategories = computed<Category[]>(() => {
  const cats = [...referenceData.categories] as Category[]

  // Add user commands to appropriate categories or create "User Commands" category
  if (userCommands.value.length > 0) {
    const userCat: Category = {
      name: 'User Commands',
      icon: 'user',
      commands: []
    }

    for (const cmd of userCommands.value) {
      if (cmd.category) {
        const existingCat = cats.find(c => c.name === cmd.category)
        if (existingCat) {
          existingCat.commands.push(cmd)
          continue
        }
      }
      userCat.commands.push(cmd)
    }

    if (userCat.commands.length > 0) {
      cats.push(userCat)
    }
  }

  return cats
})

// Filtered categories based on search
const filteredCategories = computed(() => {
  if (!searchQuery.value.trim()) {
    return allCategories.value
  }

  const query = searchQuery.value.toLowerCase()
  const result: Category[] = []

  for (const cat of allCategories.value) {
    const matchingCommands = cat.commands.filter(cmd =>
      cmd.name.toLowerCase().includes(query) ||
      cmd.description.toLowerCase().includes(query) ||
      cmd.syntax.toLowerCase().includes(query)
    )

    if (matchingCommands.length > 0) {
      result.push({
        ...cat,
        commands: matchingCommands
      })
    }
  }

  return result
})

function toggleCategory(name: string) {
  if (expandedCategories.value.has(name)) {
    expandedCategories.value.delete(name)
  } else {
    expandedCategories.value.add(name)
  }
}

function expandAll() {
  for (const cat of allCategories.value) {
    expandedCategories.value.add(cat.name)
  }
}

function collapseAll() {
  expandedCategories.value.clear()
}

function getCategoryIcon(icon: string): string {
  const icons: Record<string, string> = {
    folder: '📁',
    code: '💻',
    settings: '⚙️',
    music: '🎵',
    terminal: '🖥️',
    api: '🔌',
    grid: '🎯',
    keyboard: '⌨️',
    user: '👤'
  }
  return icons[icon] || '📋'
}

// Add/Edit form functions
function openAddForm() {
  showAddForm.value = true
  editingCommand.value = null
  formName.value = ''
  formSyntax.value = ''
  formDescription.value = ''
  formExamples.value = ''
  formCategory.value = ''
}

function openEditForm(cmd: UserCommand) {
  showAddForm.value = true
  editingCommand.value = cmd
  formName.value = cmd.name
  formSyntax.value = cmd.syntax
  formDescription.value = cmd.description
  formExamples.value = cmd.examples?.join('\n') || ''
  formCategory.value = cmd.category || ''
}

function closeForm() {
  showAddForm.value = false
  editingCommand.value = null
}

function saveCommand() {
  if (!formName.value.trim() || !formDescription.value.trim()) {
    return
  }

  const cmd: UserCommand = {
    name: formName.value.trim(),
    syntax: formSyntax.value.trim() || formName.value.trim(),
    description: formDescription.value.trim(),
    examples: formExamples.value.trim() ? formExamples.value.trim().split('\n').filter(Boolean) : undefined,
    category: formCategory.value.trim() || undefined
  }

  if (editingCommand.value) {
    // Update existing
    const idx = userCommands.value.findIndex(c => c.name === editingCommand.value!.name)
    if (idx >= 0) {
      userCommands.value[idx] = cmd
    }
  } else {
    // Add new
    userCommands.value.push(cmd)
  }

  saveUserCommands()
  closeForm()
}

function deleteCommand(cmd: UserCommand) {
  const idx = userCommands.value.findIndex(c => c.name === cmd.name)
  if (idx >= 0) {
    userCommands.value.splice(idx, 1)
    saveUserCommands()
  }
}

function isUserCommand(cmd: Command): cmd is UserCommand {
  return userCommands.value.some(c => c.name === cmd.name)
}

// When search changes, expand matching categories
watch(searchQuery, (query) => {
  if (query.trim()) {
    for (const cat of filteredCategories.value) {
      expandedCategories.value.add(cat.name)
    }
  }
})
</script>

<template>
  <div class="h-full flex flex-col bg-editor-bg text-gray-300 text-sm">
    <!-- Header with search -->
    <div class="p-2 border-b border-editor-border space-y-2">
      <div class="flex items-center gap-2">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search commands..."
          class="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm focus:outline-none focus:border-allolib-blue"
        />
        <button
          @click="openAddForm"
          class="px-2 py-1 text-xs bg-allolib-blue text-white rounded hover:bg-blue-600 transition-colors"
          title="Add custom command"
        >
          + Add
        </button>
      </div>
      <div class="flex gap-2 text-xs">
        <button
          @click="expandAll"
          class="text-gray-500 hover:text-gray-300 transition-colors"
        >
          Expand All
        </button>
        <span class="text-gray-600">|</span>
        <button
          @click="collapseAll"
          class="text-gray-500 hover:text-gray-300 transition-colors"
        >
          Collapse All
        </button>
      </div>
    </div>

    <!-- Add/Edit Form Modal -->
    <div
      v-if="showAddForm"
      class="absolute inset-0 bg-black/50 flex items-center justify-center z-50"
      @click.self="closeForm"
    >
      <div class="bg-gray-800 rounded-lg p-4 w-96 max-w-[90%] space-y-3 border border-gray-700">
        <h3 class="text-white font-medium">
          {{ editingCommand ? 'Edit Command' : 'Add Custom Command' }}
        </h3>

        <div>
          <label class="block text-xs text-gray-400 mb-1">Name *</label>
          <input
            v-model="formName"
            type="text"
            placeholder="mycommand"
            class="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-allolib-blue"
          />
        </div>

        <div>
          <label class="block text-xs text-gray-400 mb-1">Syntax</label>
          <input
            v-model="formSyntax"
            type="text"
            placeholder="mycommand [args]"
            class="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-allolib-blue"
          />
        </div>

        <div>
          <label class="block text-xs text-gray-400 mb-1">Description *</label>
          <textarea
            v-model="formDescription"
            placeholder="What does this command do?"
            rows="2"
            class="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-allolib-blue resize-none"
          />
        </div>

        <div>
          <label class="block text-xs text-gray-400 mb-1">Examples (one per line)</label>
          <textarea
            v-model="formExamples"
            placeholder="mycommand arg1&#10;mycommand --flag"
            rows="2"
            class="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-allolib-blue resize-none font-mono"
          />
        </div>

        <div>
          <label class="block text-xs text-gray-400 mb-1">Category (optional)</label>
          <input
            v-model="formCategory"
            type="text"
            placeholder="Scripting"
            class="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-allolib-blue"
          />
          <p class="text-xs text-gray-500 mt-1">Leave blank to add to "User Commands"</p>
        </div>

        <div class="flex justify-end gap-2 pt-2">
          <button
            @click="closeForm"
            class="px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            @click="saveCommand"
            :disabled="!formName.trim() || !formDescription.trim()"
            class="px-3 py-1.5 text-sm bg-allolib-blue text-white rounded hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ editingCommand ? 'Save' : 'Add' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Command list -->
    <div class="flex-1 overflow-y-auto">
      <div v-if="filteredCategories.length === 0" class="p-4 text-center text-gray-500">
        No commands found matching "{{ searchQuery }}"
      </div>

      <div v-for="category in filteredCategories" :key="category.name" class="border-b border-editor-border last:border-b-0">
        <!-- Category header -->
        <button
          @click="toggleCategory(category.name)"
          class="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-800 transition-colors text-left"
        >
          <span class="text-xs transition-transform" :class="{ 'rotate-90': expandedCategories.has(category.name) }">▶</span>
          <span>{{ getCategoryIcon(category.icon) }}</span>
          <span class="font-medium text-white">{{ category.name }}</span>
          <span class="text-gray-500 text-xs">({{ category.commands.length }})</span>
        </button>

        <!-- Commands list -->
        <div v-show="expandedCategories.has(category.name)" class="pb-2">
          <div
            v-for="cmd in category.commands"
            :key="cmd.name"
            class="mx-2 mb-1 p-2 rounded bg-gray-800/50 hover:bg-gray-800 transition-colors group"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="flex-1 min-w-0">
                <!-- Command name and syntax -->
                <div class="flex items-center gap-2 flex-wrap">
                  <code class="text-allolib-blue font-medium">{{ cmd.name }}</code>
                  <code v-if="cmd.syntax !== cmd.name" class="text-gray-500 text-xs">{{ cmd.syntax }}</code>
                </div>

                <!-- Description -->
                <p class="text-gray-400 text-xs mt-1">{{ cmd.description }}</p>

                <!-- Flags -->
                <div v-if="cmd.flags && cmd.flags.length > 0" class="mt-2 space-y-0.5">
                  <div v-for="flag in cmd.flags" :key="flag.flag" class="text-xs">
                    <code class="text-yellow-500">{{ flag.flag }}</code>
                    <span class="text-gray-500 ml-2">{{ flag.description }}</span>
                  </div>
                </div>

                <!-- Examples -->
                <div v-if="cmd.examples && cmd.examples.length > 0" class="mt-2">
                  <div class="text-xs text-gray-500 mb-0.5">Examples:</div>
                  <div v-for="example in cmd.examples" :key="example" class="text-xs">
                    <code class="text-green-400 font-mono">{{ example }}</code>
                  </div>
                </div>
              </div>

              <!-- Edit/Delete for user commands -->
              <div v-if="isUserCommand(cmd)" class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  @click.stop="openEditForm(cmd as UserCommand)"
                  class="p-1 text-gray-500 hover:text-white transition-colors"
                  title="Edit"
                >
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  @click.stop="deleteCommand(cmd as UserCommand)"
                  class="p-1 text-gray-500 hover:text-red-400 transition-colors"
                  title="Delete"
                >
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="p-2 border-t border-editor-border text-xs text-gray-500 text-center">
      Type <code class="text-yellow-500">help [command]</code> in terminal for detailed info
    </div>
  </div>
</template>

<style scoped>
code {
  font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
}
</style>

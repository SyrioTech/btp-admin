import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import AccountTreeNode from '@/components/accounts/AccountTreeNode.vue'
import type { DirectoryNode, SubaccountNode } from '@/components/accounts/AccountTreeNode.vue'

// ── Fixtures ────────────────────────────────────────────────────────────────

const subaccountLeaf: SubaccountNode = {
  type: 'subaccount',
  guid: 'sa-1',
  displayName: 'My Subaccount',
  region: 'eu10',
  subdomain: 'my-sub',
  state: 'OK',
  parentGUID: 'dir-1',
}

const failedSubaccount: SubaccountNode = {
  type: 'subaccount',
  guid: 'sa-fail',
  displayName: 'Broken Sub',
  region: 'us10',
  subdomain: 'broken',
  state: 'CREATION_FAILED',
}

const emptyDir: DirectoryNode = {
  type: 'directory',
  guid: 'dir-empty',
  displayName: 'Empty Folder',
  directoryType: 'FOLDER',
  state: 'OK',
  childDirs: [],
  childSubs: [],
}

const dirWithChildren: DirectoryNode = {
  type: 'directory',
  guid: 'dir-1',
  displayName: 'Parent Dir',
  directoryType: 'FOLDER',
  state: 'OK',
  childDirs: [
    {
      type: 'directory',
      guid: 'dir-child',
      displayName: 'Child Dir',
      directoryType: 'FOLDER',
      state: 'OK',
      childDirs: [],
      childSubs: [subaccountLeaf],
    },
  ],
  childSubs: [
    { ...subaccountLeaf, guid: 'sa-direct', displayName: 'Direct Sub' },
  ],
}

function mountNode(node: DirectoryNode | SubaccountNode, extra: Record<string, unknown> = {}) {
  return mount(AccountTreeNode, {
    props: { node, ...extra },
    global: {
      plugins: [createPinia()],
      // RouterLink requires VueRouter; stub it since navigation isn't under test here
      stubs: { RouterLink: true },
    },
  })
}

// ── Subaccount leaf ──────────────────────────────────────────────────────────

describe('AccountTreeNode — subaccount leaf', () => {
  it('renders the subaccount display name', () => {
    const w = mountNode(subaccountLeaf)
    expect(w.text()).toContain('My Subaccount')
  })

  it('renders the state badge', () => {
    const w = mountNode(subaccountLeaf)
    expect(w.text()).toContain('OK')
  })

  it('renders a non-OK state badge for failed subaccounts', () => {
    const w = mountNode(failedSubaccount)
    expect(w.text()).toContain('CREATION_FAILED')
  })

  it('emits select with the node when clicked', async () => {
    const w = mountNode(subaccountLeaf)
    await w.find('button').trigger('click')
    const events = w.emitted('select') as SubaccountNode[][]
    expect(events).toHaveLength(1)
    expect(events[0]![0]!.guid).toBe('sa-1')
  })

  it('applies accent class when selectedGuid matches', () => {
    const w = mountNode(subaccountLeaf, { selectedGuid: 'sa-1' })
    // accent class is on the wrapper div, not the inner select button
    expect(w.find('.bg-accent').exists()).toBe(true)
  })

  it('does not apply accent class when selectedGuid differs', () => {
    const w = mountNode(subaccountLeaf, { selectedGuid: 'other-guid' })
    expect(w.find('.bg-accent').exists()).toBe(false)
  })

  it('does not show a chevron icon', () => {
    const w = mountNode(subaccountLeaf)
    // Chevrons only appear in directory nodes; the button should not contain them
    // (the directory chevron button is separate from the subaccount button)
    const buttons = w.findAll('button')
    // Subaccount renders exactly one button
    expect(buttons).toHaveLength(1)
  })
})

// ── Directory node ───────────────────────────────────────────────────────────

describe('AccountTreeNode — directory node', () => {
  it('renders the directory display name', () => {
    const w = mountNode(emptyDir)
    expect(w.text()).toContain('Empty Folder')
  })

  it('shows child count of zero for empty directories', () => {
    const w = mountNode(emptyDir)
    // No count number rendered when childCount === 0
    // Empty hint shown instead when expanded
    expect(w.text()).toContain('Empty directory')
  })

  it('shows the total child count when children exist', () => {
    const w = mountNode(dirWithChildren)
    // dir has 1 childDir + 1 childSub → count = 2
    expect(w.text()).toContain('2')
  })

  it('renders child directory names when expanded', () => {
    const w = mountNode(dirWithChildren)
    expect(w.text()).toContain('Child Dir')
  })

  it('renders direct child subaccount names when expanded', () => {
    const w = mountNode(dirWithChildren)
    expect(w.text()).toContain('Direct Sub')
  })

  it('renders nested (grandchild) subaccount inside child directory', () => {
    const w = mountNode(dirWithChildren)
    expect(w.text()).toContain('My Subaccount')
  })

  it('hides children after toggling collapse', async () => {
    const w = mountNode(dirWithChildren)
    // Click the directory header button to collapse
    await w.find('button').trigger('click')
    // After collapse, child names should not be visible (v-show hides)
    const childDiv = w.find('div[style*="display: none"], [style*="display:none"]')
    // v-show sets display:none on the wrapper div
    expect(childDiv.exists()).toBe(true)
  })

  it('shows children again after re-expanding', async () => {
    const w = mountNode(dirWithChildren)
    const headerBtn = w.find('button')
    // Collapse
    await headerBtn.trigger('click')
    // Expand again
    await headerBtn.trigger('click')
    expect(w.text()).toContain('Direct Sub')
  })

  it('emits select from a nested subaccount up through the directory', async () => {
    const w = mountNode(dirWithChildren)
    // Find the Direct Sub button (last button at root level of this component)
    const buttons = w.findAll('button').filter((b) => b.text().includes('Direct Sub'))
    expect(buttons.length).toBeGreaterThan(0)
    await buttons[0]!.trigger('click')
    const events = w.emitted('select') as SubaccountNode[][]
    expect(events).toHaveLength(1)
    expect(events[0]![0]!.displayName).toBe('Direct Sub')
  })

  it('does not apply accent class to directory header', () => {
    const w = mountNode(dirWithChildren, { selectedGuid: 'dir-1' })
    // Directory headers don't get selected styling (only subaccounts do)
    const dirBtn = w.find('button')
    expect(dirBtn.classes()).not.toContain('bg-accent')
  })
})

// ── Depth / indentation ──────────────────────────────────────────────────────

describe('AccountTreeNode — depth prop', () => {
  it('applies greater left padding at depth 2 than at depth 0 for a subaccount', () => {
    const w0 = mountNode(subaccountLeaf, { depth: 0 })
    const w2 = mountNode(subaccountLeaf, { depth: 2 })
    // padding-left is on the wrapper div, not the inner button
    const style0 = w0.find('div[style]').attributes('style') ?? ''
    const style2 = w2.find('div[style]').attributes('style') ?? ''
    const px0 = parseInt(style0.match(/padding-left:\s*(\d+)px/)?.[1] ?? '0')
    const px2 = parseInt(style2.match(/padding-left:\s*(\d+)px/)?.[1] ?? '0')
    expect(px2).toBeGreaterThan(px0)
  })

  it('applies greater left padding at depth 1 than depth 0 for a directory', () => {
    const w0 = mountNode(emptyDir, { depth: 0 })
    const w1 = mountNode(emptyDir, { depth: 1 })
    const style0 = w0.find('button').attributes('style') ?? ''
    const style1 = w1.find('button').attributes('style') ?? ''
    const px0 = parseInt(style0.match(/padding-left:\s*(\d+)px/)?.[1] ?? '0')
    const px1 = parseInt(style1.match(/padding-left:\s*(\d+)px/)?.[1] ?? '0')
    expect(px1).toBeGreaterThan(px0)
  })
})

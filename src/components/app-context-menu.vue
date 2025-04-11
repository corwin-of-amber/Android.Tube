<template>
    <context-menu ref="m" @action="$emit('action', $event)" :options="{debug: true}">
      <item name="playlist-new">New playlist</item>
      <hr/>
      <item name="copy-id">Copy ID</item>
      <item name="copy-url">Copy URL</item>
      <item name="set-global">Set as global variable</item>
      <item name="download">Download</item>
      <hr/>
      <item name="connect">Connect to Remote</item>
      <item name="play-remote" class="has-companion"><span>Play on Remote</span>
          <button class="companion" name="play-remote-all">↧</button>
      </item>
      <item name="upload" class="has-companion"><span>Upload</span>
        <button class="companion" name="upload-all">↧</button>
      </item>
    </context-menu>
</template>

<script lang="ts">
import { Vue, Component, Ref, toNative } from 'vue-facing-decorator';
import { ContextMenu, ContextMenuItem } from '../../packages/context-menu';

@Component({
    components: { ContextMenu, item: ContextMenuItem },
    emits: ['action']
})
class IAppContextMenu extends Vue {
    @Ref m: any
    get for() { return this.m.for; }
    open(...args) { this.m.open(...args); }
}

export { IAppContextMenu }
export default toNative(IAppContextMenu)
</script>
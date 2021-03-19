<template>
    <context-menu ref="m" @action="$emit('action', $event)">
      <li name="playlist-new">New playlist</li>
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

<script>
import ContextMenu from './context-menu.vue';
import MenuItem from './context-menu-item.vue';

export default {
    components: {ContextMenu, item: MenuItem},
    computed: {
        for() { return this.$refs.m.for; }
    },
    methods: {
        open(...args) { this.$refs.m.open(...args); }
    }
}
</script>
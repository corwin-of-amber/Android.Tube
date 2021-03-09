<template>
    <vue-context ref="m" @action="$emit('action', $event)">
      <item name="playlist-new">New playlist</item>
      <hr/>
      <item name="copy-id">Copy ID</item>
      <item name="copy-url">Copy URL</item>
      <item name="set-global">Set as global variable</item>
      <item name="download">Download</item>
      <hr/>
      <item name="connect">Connect to Remote</item>
      <item name="play-remote">Play on Remote
        <button class="companion" name="play-remote-all">↧</button>
      </item>
      <item name="upload">Upload
        <button class="companion" name="upload-all">↧</button>
      </item>
    </vue-context>
</template>

<script>
import VueContext from './context-menu.vue';
import MenuItem from './context-menu-item.vue';

export default {
    components: {VueContext, item: MenuItem},
    computed: {
        for() { return this.$refs.m.for; }
    },
    methods: {
        open(...args) { this.$refs.m.open(...args); }
    }
}
</script>
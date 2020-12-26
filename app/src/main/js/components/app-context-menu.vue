<template>
    <vue-context ref="m" @action="$emit('action', $event)">
      <item name="copy-id">Copy ID</item>
      <item name="copy-url">Copy URL</item>
      <item name="set-global">Set as global variable</item>
      <item name="download">Download</item>
      <hr/>
      <item name="connect">Connect to Remote</item>
      <item name="play-remote">Play on Remote</item>
    </vue-context>
</template>

<script>
import VueContext from './context-menu.vue';
import MenuItem from './context-menu-item.vue';

export default {
    components: {VueContext, item: MenuItem},
    methods: {
        open(...args) { this.$refs.m.open(...args); }
    }
}
</script>
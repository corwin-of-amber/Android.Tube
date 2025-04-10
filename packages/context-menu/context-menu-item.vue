<template>
    <item :name="name" :disabled="!enabled" @click="action"><slot></slot></item>
</template>

<script>
import ContextMenu from "./context-menu.vue";
import { ContextmenuItem as Item } from "v-contextmenu";

export default {
    props: {'name': {}, 'enabled': {default: true}},
    components: { Item },
    methods: {
        action() {
            var m = this.menu();
            if (m) m.action({name: this.name});
        },
        menu() {
            for (var v = this;
                 v && !(v._.type === ContextMenu); v = v.$parent) ;
            return v;
        }
    }
}
</script>
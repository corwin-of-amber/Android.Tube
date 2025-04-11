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
        action(ev) {
            var m = this.menu();
            if (m) {
                m.action({name: this.widgetName(ev?.target) ?? this.name});
            }
        },
        menu() {
            for (var v = this;
                 v && !(v._.type === ContextMenu); v = v.$parent) ;
            return v;
        },
        /**
         * Allows defining a companion button or other sub-element that
         * emits a different action than the item's name.
         * @param el the clicked element
         */
        widgetName(el) {
            return el?.classList.contains('companion') ? el.name : undefined;
        }
    }
}
</script>
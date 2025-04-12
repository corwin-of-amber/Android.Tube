<template>
    <context-menu @hide="onClose" ref="m">
        <slot></slot>
    </context-menu>
</template>

<style src="./context-menu.scss"></style>

<script>
import { Contextmenu as ContextMenu } from "v-contextmenu";
import "v-contextmenu/dist/themes/default.css";
import './context-menu.scss';


export default {
    props: {theme: {default: 'compact'}, options: {default: {}}},
    data: () => ({for: undefined}),
    emits: ['action'],
    components: { ContextMenu },

    mounted() {
        // this is a bit low-level, in order to style the element
        // before it is placed
        this.$watch(() => this.$refs.m.contextmenuRef, el => {
            if (el) this._setupElement(el);
        });
    },

    methods: {
        open(ev, whatFor) {
            this.for = whatFor;
            this.$refs.m.show(ev);
        },
        _setupElement(el) {
            el.classList.add('compact');
            if (!this.options.debug) {
                el.setAttribute('tabindex', 1);
                el.focus();
                el.addEventListener('blur', () => this.onBlur());
            }
        },
        close() {
            this.$refs.m.hide();
        },
        action(ev) {
            this.$emit('action', {type: ev.name, for: this.for});
        },
        onClose() {
            this.for = undefined;
        },
        onBlur() { this.close(); }
    }
}
</script>
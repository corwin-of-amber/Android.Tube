<template>
    <context-menu ref="m">
        <slot></slot>
    </context-menu>
</template>

<style src="./context-menu.css"></style>

<script>
import { Contextmenu as ContextMenu } from "v-contextmenu";
import "v-contextmenu/dist/themes/default.css";
import './context-menu.css'


export default {
    props: {theme: {default: 'compact'}, options: {default: {}}},
    data: () => ({for: undefined}),
    emits: ['action'],
    components: { ContextMenu },
    methods: {
        open(ev, whatFor) {
            this.for = whatFor;
            this.$refs.m.show(ev);
            requestAnimationFrame(() => {
                this._setupElement(document.querySelector('.v-contextmenu'));
            });
        },
        _setupElement(el) {
            el.classList.add('compact');
            el.setAttribute('tabindex', 1);
            el.focus();
            if (!this.options.debug)
                el.addEventListener('blur', () => this.onBlur());
        },
        close() {
            this.$refs.m.hide();
        },
        action(ev) {
            this.$emit('action', {type: ev.name, for: this.for});
        },
        onClose() {
            setTimeout(() => this.for = undefined, 0); /** @oops must happen after `action` handler */
        },
        onBlur() { this.close(); }
    }
}
</script>
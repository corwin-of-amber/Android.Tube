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
        this.$watch(() => this._el(), el => {
            if (el) this._setupElement(el);
        });
    },

    methods: {
        open(ev, whatFor) {
            this.for = whatFor;
            this.$refs.m.show(ev);
        },
        _el() { 
            return this.$refs.m.contextmenuRef;
        },
        _setupElement(el) {
            el.classList.add('compact');
            if (!this.options.debug) {
                el.setAttribute('tabindex', 1);
                el.focus();
                el.addEventListener('blur', ev => this.onBlur(ev));
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
        onBlur(ev) {
            if (ev.currentTarget.contains(ev.relatedTarget))
                this._el().focus();
            else
                this.close();
        }
    }
}
</script>
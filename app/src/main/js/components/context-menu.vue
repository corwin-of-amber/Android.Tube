<template>
    <vue-context ref="m" @click.native="action" :class="theme">
        <slot></slot>
    </vue-context>
</template>

<style>
ul.compact[role=menu] {
    font-family: sans-serif;
    font-size: 10pt;
    line-height: 15pt;
    padding: 2px 0;
    background: #eeee;
}

ul.compact[role=menu] > li > a {
    padding: 1px 1rem;
}

ul.compact[role=menu] > li > a:hover {
    background: rgb(46, 103, 160);
    color: white;
    cursor: default;
}
</style>

<script>
import VueContext from 'vue-context';


export default {
    props: {theme: {default: 'compact'}},
    data: () => ({for: undefined}),
    components: {VueContext},
    methods: {
        open(ev, whatFor) {
            this.for = whatFor;
            this.$refs.m.open(ev);
        },
        action(ev) {
            var item = ev.target.closest('li[name]');
            if (item) {
                var name = item.getAttribute('name');
                this.$emit('action', {type: name, for: this.for});
            }
        }
    }
}
</script>
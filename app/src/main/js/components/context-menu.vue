<template>
    <vue-context ref="m" @click.native="action" @close="onClose" :class="theme">
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

ul[role=menu] button.companion {
    float: right;
    font-family: STIXGeneral;  /* @todo get rid of this */
    border: none;
    background: transparent;
    color: inherit;
    opacity: 0.3;
    border-radius: 99px;
    padding: 0 .7em;
    margin-left: 1.5em;
    margin-right: -.3em;    
}

ul[role=menu] a:hover button.companion {
    opacity: 0.7;
    background: #fff3;
}
ul[role=menu] a:hover button.companion:hover {
    opacity: 1;
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
            var item = ev.target.closest('*[name]');
            if (item) {
                var name = item.getAttribute('name');
                this.$emit('action', {type: name, for: this.for});
            }
        },
        onClose() {
            setTimeout(() => this.for = undefined, 0); /** @oops must happen after `action` handler */
        }
    }
}
</script>
<template>
    <h1 contenteditable="true"
        @keydown="keydown" @blur="commit">{{value}}</h1>
</template>

<script>
export default {
    props: ['value'],
    methods: {
        keydown(ev) {
            switch (ev.key) {
            case 'Enter':
                ev.preventDefault();
                this.commit();  break;
            case 'Escape':
                ev.preventDefault();
                this.rollback();  break;
            }
        },
        commit() {
            this.$emit('update:value', this.$el.textContent);
            this.$el.blur();
        },
        rollback() {
            this.$el.textContent = this.value;
            this.$el.blur();
        }
    }
}
</script>
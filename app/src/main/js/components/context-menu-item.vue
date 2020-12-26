<template>
    <li :name="name" :class="{disabled: !enabled}"><a><slot></slot></a></li>
</template>

<script>
export default {
    props: {'name': {}, 'enabled': true}
}
</script>


Vue.component('playlist-ui', {
    props: ['name', 'active'],
    data: () => ({ items: [] }),
    template:
    `
    <div class="playlist-ui" @dragover="dragOver" @drop="drop">
        <h1 contenteditable="true">{{name}}</h1>
        <template v-for="item in items">
            <div class="playlist-item">
                <div class="gutter"/>
                <video-snippet
                    :item="item" :active="item.id.videoId === active"
                    @click="$emit('selected', item)"/>
            </div>
        </template>
    </div>
    `,

    methods: {
        dragOver(ev) {
            ev.preventDefault();
        },
        drop(ev) {
            var item = ev.dataTransfer.getData("json");
            if (item) {
                item = JSON.parse(item);
                if (item.id) {
                    this.items.push(item);
                }
            }
        }
    }
});


<template>
  <bk-sideslider
    :is-show.sync="isShow"
    :width="960"
    :quick-close="true"
    @hidden="handleHidden"
  >
    <div
      slot="header"
      class="flex-row align-items-center"
    >
      {{ $t('查看实例') }}
      <bk-divider direction="vertical"></bk-divider>
      <span class="header-sub-title"> {{ $t('方案') }}: {{ quotaPlan.name }}</span>
    </div>
    <div
      slot="content"
      class="affected-instances-content p-24"
    >
      <AffectedInstancesTable
        v-if="isShow"
        :quota-plan-id="quotaPlan.id"
        :default-limit="10"
      />
    </div>
  </bk-sideslider>
</template>

<script>
import AffectedInstancesTable from './affected-instances-table.vue';

export default {
  name: 'AffectedInstancesSideslider',
  components: {
    AffectedInstancesTable,
  },
  props: {
    visible: {
      type: Boolean,
      default: false,
    },
    quotaPlan: {
      type: Object,
      default: () => ({}),
    },
  },
  computed: {
    isShow: {
      get() {
        return this.visible;
      },
      set(val) {
        this.$emit('update:visible', val);
      },
    },
  },
  methods: {
    handleHidden() {
      this.$emit('update:visible', false);
    },
  },
};
</script>

<style lang="scss" scoped>
.affected-instances-content {
  height: calc(100vh - 60px);
  overflow-y: auto;
}
.header-sub-title {
  font-size: 12px;
  color: #979ba5;
}
</style>

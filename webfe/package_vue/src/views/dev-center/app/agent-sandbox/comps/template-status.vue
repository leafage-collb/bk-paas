<template>
  <span
    v-bk-tooltips="{ content: tooltip, disabled: !tooltip, allowHTML: false }"
    :class="['template-status', statusClass]"
  >
    <span v-if="statusClass" class="status-dot" />{{ label }}
  </span>
</template>

<script>
export default {
  name: 'SandboxTemplateStatus',
  props: {
    status: {
      type: String,
      default: '',
    },
    message: {
      type: String,
      default: '',
    },
  },
  computed: {
    statusLabels() {
      return {
        available: this.$t('可用'),
        syncing: this.$t('同步中'),
        sync_failed: this.$t('失败'),
        no_cluster: this.$t('无可用集群'),
      };
    },
    label() {
      return this.statusClass ? this.statusLabels[this.status] : this.status || '--';
    },
    statusClass() {
      return Object.prototype.hasOwnProperty.call(this.statusLabels, this.status) ? this.status : '';
    },
    tooltip() {
      return this.status === 'sync_failed'
        ? this.message || this.$t('模板下发失败，请稍后重试或联系管理员。')
        : '';
    },
  },
};
</script>

<style lang="scss" scoped>
.template-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #63656e;
  white-space: nowrap;
  .status-dot {
    flex-shrink: 0;
    width: 13px;
    height: 13px;
    border: 3px solid #f0f1f5;
    border-radius: 50%;
    background: #979ba5;
  }
  &.available .status-dot {
    background: #3fc06d;
    border-color: #daefe4;
  }
  &.no_cluster .status-dot {
    background: #979ba5;
    border-color: #f0f1f5;
  }
  &.syncing .status-dot {
    background: #ff9c01;
    border-color: #ffefd6;
  }
  &.sync_failed {
    cursor: help;
    .status-dot {
      background: #ea3636;
      border-color: #fce0e0;
    }
  }
}
</style>

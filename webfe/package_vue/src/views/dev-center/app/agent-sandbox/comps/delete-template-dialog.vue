<template>
  <bk-dialog
    v-model="visible"
    class="delete-template-dialog"
    :title="$t('是否删除该模板？')"
    :width="480"
    :mask-close="false"
    :close-icon="!loading"
    :esc-close="!loading"
    header-position="center"
    footer-position="center"
  >
    <p class="template-name">
      <span class="template-label">{{ $t('沙箱模板') }}：</span>{{ template ? template.name || template.template_id : '' }}
    </p>
    <div class="delete-description">
      {{ $t('删除该模板后将无法恢复，已按该模板运行的沙箱实例不受影响，请谨慎操作') }}
    </div>
    <div slot="footer">
      <bk-button theme="danger" :loading="loading" :disabled="loading" @click="confirmDelete">
        {{ $t('删除') }}
      </bk-button>
      <bk-button :disabled="loading" @click="visible = false">{{ $t('取消') }}</bk-button>
    </div>
  </bk-dialog>
</template>

<script>

export default {
  name: 'DeleteSandboxTemplateDialog',
  props: {
    appCode: {
      type: String,
      required: true,
    },
  },
  data() {
    return { visible: false, template: null, loading: false };
  },
  watch: {
    visible(value) {
      if (!value) this.reset();
    },
    appCode: 'reset',
  },
  methods: {
    open(template) {
      if (this.visible || this.loading || template?.is_builtin !== false || !template.template_id) return;
      this.template = template;
      this.visible = true;
    },
    reset() {
      this.visible = false;
      this.template = null;
      this.loading = false;
    },
    async confirmDelete() {
      if (!this.template || this.loading) return;
      const { appCode } = this;
      const templateId = this.template.template_id;
      this.loading = true;
      try {
        await this.$store.dispatch('agentSandbox/deleteTemplate', { appCode, templateId });
        this.$paasMessage({ theme: 'success', message: this.$t('删除成功') });
        this.visible = false;
        this.$emit('deleted', templateId);
      } catch (error) {
        // 模板已被删除时同步关闭弹窗并刷新列表
        if (error.status === 404) {
          this.visible = false;
          this.$emit('deleted', templateId);
        }
        this.catchErrorHandler(error);
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>

<style lang="scss" scoped>
.delete-template-dialog {
  /deep/ .bk-dialog-header {
    padding: 15px 30px 0;
    .bk-dialog-header-inner {
      font-size: 20px;
    }
  }
  /deep/ .bk-dialog-body {
    padding: 16px 30px 24px;
    color: #313238;
    line-height: normal;
  }
  /deep/ .bk-dialog-footer {
    padding: 0 65px 33px;
    background: #fff;
    border: none;
    .bk-button {
      min-width: 88px;
    }
    .bk-button + .bk-button {
      margin-left: 8px;
    }
  }
}
.template-name {
  margin: 0;
  overflow-wrap: anywhere;
}
.template-label {
  color: #63656e;
}
.delete-description {
  margin-top: 12px;
  padding: 12px;
  color: #63656e;
  line-height: 22px;
  background: #f5f6fa;
  border-radius: 2px;
}
</style>

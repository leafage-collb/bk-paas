<template>
  <bk-sideslider
    :is-show.sync="visible"
    :width="960"
    :title="isEdit ? $t('编辑模板') : $t('新建模板')"
    :quick-close="true"
    :before-close="handleBeforeClose"
    show-mask
    ext-cls="sandbox-template-editor"
  >
    <div slot="content" v-bkloading="{ isLoading: loading, zIndex: 10 }" class="template-editor-content">
      <template-form
        v-if="visible && !loading"
        :key="formKey"
        ref="form"
        :app-code="appCode"
        :template-data="template"
        :is-edit="isEdit"
        :disabled="submitting"
        :field-errors="fieldErrors"
        @field-change="clearFieldError"
      />
      <bk-alert
        v-if="visible && !loading"
        type="warning"
        class="submit-notice"
        :title="$t('保存后会异步下发到应用可用的 e2b 集群，下发完成前无法用它创建沙箱。已有的预热实例保持旧配置，直到被消耗完。')"
      />
    </div>
    <div slot="footer" class="template-editor-footer">
      <bk-button
        theme="primary"
        :loading="submitting"
        :disabled="loading"
        @click="save"
      >{{ isEdit ? $t('保存') : $t('创建') }}</bk-button>
      <bk-button :disabled="submitting" @click="close">{{ $t('取消') }}</bk-button>
    </div>
  </bk-sideslider>
</template>

<script>
import TemplateForm from '@/components/agent-sandbox/template-form.vue';
import sidebarDiffMixin from '@/mixins/sidebar-diff-mixin';
import { getErrorMessage } from '../utils';

// 把后端返回的字段错误（字符串/数组/嵌套对象）递归拍平成一行提示文本
function fieldErrorText(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value.map(fieldErrorText).filter(Boolean)
      .join('; ');
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).map(([key, error]) => `${key}: ${fieldErrorText(error)}`)
      .join('; ');
  }
  return '';
}

export default {
  name: 'SandboxTemplateSideslider',
  components: { TemplateForm },
  mixins: [sidebarDiffMixin],
  props: {
    appCode: { type: String, required: true },
  },
  data() {
    return {
      visible: false,
      templateId: '',
      template: {},
      loading: false,
      submitting: false,
      fieldErrors: {},
      formKey: 0,
    };
  },
  computed: {
    // 有模板 ID 即为编辑态，否则为新建态
    isEdit() {
      return Boolean(this.templateId);
    },
  },
  watch: {
    // 切换应用时清空并关闭侧滑，避免脏数据
    appCode() {
      this.reset();
    },
  },
  methods: {
    // 重置全部状态并清空差异基线
    reset() {
      this.formKey += 1;
      this.visible = false;
      this.templateId = '';
      this.template = {};
      this.loading = false;
      this.submitting = false;
      this.fieldErrors = {};
      this.initSidebarFormData({});
    },
    // 打开新建侧滑，并记录表单初始状态作为关闭确认的基线
    async openCreate() {
      if (this.submitting || !this.appCode) return;
      this.reset();
      this.visible = true;
      await this.$nextTick();
      this.captureInitialState();
    },
    // 打开编辑侧滑并拉取模板详情
    openEdit(templateId) {
      if (this.submitting || !this.appCode || !templateId) return;
      this.reset();
      this.templateId = templateId;
      this.visible = true;
      this.loadTemplate();
    },
    // 把当前表单草稿快照记为初始基线，供关闭前差异判断
    captureInitialState() {
      if (this.$refs.form) this.initSidebarFormData(this.$refs.form.getDraftState());
    },
    // 拉取模板详情并回填表单
    async loadTemplate() {
      const { appCode, templateId } = this;
      this.loading = true;
      try {
        this.template = await this.$store.dispatch('agentSandbox/getTemplate', { appCode, templateId });
      } catch (error) {
        this.visible = false;
        this.catchErrorHandler(error);
        return;
      } finally {
        this.loading = false;
      }
      await this.$nextTick();
      this.captureInitialState();
    },
    // 关闭前拦截：提交中禁止关闭，表单有改动时二次确认
    async handleBeforeClose() {
      if (this.submitting) return false;
      if (!this.$refs.form) return true;
      return this.$isSidebarClosed(JSON.stringify(this.$refs.form.getDraftState()));
    },
    // 取消按钮：走完关闭校验后再真正关闭
    async close() {
      if (await this.handleBeforeClose()) this.visible = false;
    },
    // 字段内容变更后清掉该字段的校验错误
    clearFieldError(field) {
      this.$delete(this.fieldErrors, field);
    },
    // 解析接口错误并按字段回显，返回是否已全部由字段级提示覆盖（否则走全局报错）
    showFieldErrors(error) {
      if (error.code === 'AGENT_SANDBOX_E2B_TEMPLATE_ID_TOO_LONG') {
        const message = fieldErrorText(getErrorMessage(error, ''));
        if (!message) return false;
        this.fieldErrors = { template_id: message };
        return true;
      }
      const fields = error.fields_detail;
      if (!fields || typeof fields !== 'object') return false;
      const visibleFields = [
        'template_id', 'name', 'description', 'image', 'cpu_count', 'memory_mb', 'disk_size_mb', 'env_vars', 'workdir',
      ];
      const errors = {};
      Object.entries(fields).forEach(([field, value]) => {
        const message = fieldErrorText(value);
        if (visibleFields.includes(field) && message) errors[field] = message;
      });
      if (!Object.keys(errors).length) return false;
      this.fieldErrors = errors;
      return Object.keys(fields).every(field => Boolean(errors[field]));
    },
    // 校验表单后提交创建/更新，成功则关闭并通知父组件刷新
    async save() {
      if (this.submitting || this.loading || !this.$refs.form) return;
      const { appCode, templateId } = this;
      this.submitting = true;
      this.fieldErrors = {};
      let params;

      try {
        params = await this.$refs.form.validate();
      } catch (error) {
        this.submitting = false;
        if (error?.code === 'AGENT_SANDBOX_E2B_APP_CODE_TOO_LONG') this.catchErrorHandler(error);
        return;
      }
      try {
        const action = templateId ? 'agentSandbox/updateTemplate' : 'agentSandbox/createTemplate';
        const result = await this.$store.dispatch(action, { appCode, templateId, params });
        this.$paasMessage({ theme: 'success', message: this.$t('保存成功') });
        this.visible = false;
        this.$emit('saved', result);
      } catch (error) {
        if (!this.showFieldErrors(error)) this.catchErrorHandler(error);
      } finally {
        this.submitting = false;
      }
    },
  },
};
</script>

<style lang="scss">
.sandbox-template-editor {
  .bk-sideslider-wrapper {
    display: flex;
    flex-direction: column;
    height: 100%;
    max-width: 100vw;
    overflow: hidden;
  }
  .bk-sideslider-header {
    flex-shrink: 0;
  }
  .bk-sideslider-content {
    flex: 1;
    min-height: 0;
    max-height: none !important;
    overflow-y: auto;
  }
  .bk-sideslider-footer {
    flex-shrink: 0;
    height: auto;
    border-top: 0;
    background-color: #fafbfd !important;
  }
  .template-editor-content {
    min-height: 240px;
    padding: 20px 40px 32px;
  }
  .template-editor-footer {
    display: flex;
    gap: 8px;
    width: 100%;
    padding: 8px 24px;
  }
  .submit-notice {
    margin-top: 20px;
  }
}
</style>

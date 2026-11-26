<template>
  <bk-sideslider
    :is-show.sync="visible"
    :width="960"
    :title="isEdit ? $t('编辑模板') : $t('新建模板')"
    :quick-close="true"
    :before-close="handleBeforeClose"
    show-mask
    ext-cls="platform-sandbox-template-editor"
  >
    <div slot="header" class="template-editor-header">
      <span>{{ isEdit ? $t('编辑模板') : $t('新建模板') }}</span>
      <span v-if="isEdit && template.name" class="template-editor-name" :title="template.name">
        {{ template.name }}
      </span>
    </div>
    <div slot="content" v-bkloading="{ isLoading: loading, zIndex: 10 }" class="template-editor-content">
      <template-form
        v-if="visible && !loading"
        :key="formKey"
        ref="form"
        mode="platform"
        :template-data="template"
        :is-edit="isEdit"
        :disabled="submitting"
      >
        <template slot="basic-extra">
          <bk-form-item :label="$t('启用')">
            <bk-switcher
              v-model="platformFields.enabled"
              theme="primary"
              :disabled="submitting"
            />
            <p class="field-hint">{{ $t('停用后不能再用它创建沙箱，已下发的 CR 保留') }}</p>
          </bk-form-item>
          <bk-form-item :label="$t('开发者中心可见')">
            <bk-switcher
              v-model="platformFields.is_public"
              theme="primary"
              :disabled="submitting"
            />
            <p class="field-hint">{{ $t('不公开的模板不在开发者中心展示，但仍可由任意应用通过 SDK 按标识使用') }}</p>
          </bk-form-item>
        </template>
        <bk-form-item
          slot="resource-extra"
          :label="$t('每集群预热')"
          property="prewarm_count"
          :rules="prewarmRules"
          error-display-type="normal"
          class="prewarm-field"
        >
          <bk-input
            v-model="platformFields.prewarm_count"
            type="number"
            :min="0"
            :max="50"
            :precision="0"
            :disabled="submitting"
          />
          <p class="field-hint">{{ $t('每个集群常驻的预热实例数，修改后只影响新补充的实例') }}</p>
        </bk-form-item>
      </template-form>
      <bk-alert
        v-if="visible && !loading"
        type="warning"
        class="submit-notice"
        :title="$t('保存后会异步下发到所有启用 e2b 的集群，下发完成前无法用它创建沙箱。已有的预热实例保持旧配置，直到被消耗完。')"
      />
    </div>
    <div slot="footer" class="template-editor-footer">
      <bk-button theme="primary" :loading="submitting" :disabled="loading" @click="save">
        {{ isEdit ? $t('保存') : $t('创建') }}
      </bk-button>
      <bk-button :disabled="submitting" @click="close">{{ $t('取消') }}</bk-button>
    </div>
  </bk-sideslider>
</template>

<script>
import TemplateForm from '@/components/agent-sandbox/template-form.vue';
import sidebarDiffMixin from '@/mixins/sidebar-diff-mixin';

export default {
  name: 'PlatformSandboxTemplateSideslider',
  components: { TemplateForm },
  mixins: [sidebarDiffMixin],
  data() {
    return {
      visible: false,
      templateId: '',
      template: {},
      platformFields: { enabled: true, is_public: false, prewarm_count: 0 },
      loading: false,
      submitting: false,
      formKey: 0,
    };
  },
  computed: {
    isEdit() {
      return Boolean(this.templateId);
    },
    prewarmRules() {
      return [{
        validator: () => {
          const count = this.platformFields.prewarm_count;
          return count !== '' && count !== null && Number.isInteger(Number(count))
            && Number(count) >= 0 && Number(count) <= 50;
        },
        message: this.$t('每集群预热数量必须为 0–50 的整数'),
        trigger: 'blur',
      }];
    },
  },
  watch: {
    visible(value) {
      this.$emit('visibility-change', { visible: value, templateId: this.templateId });
    },
  },
  methods: {
    // 清空草稿和平台字段，并递增 formKey，使进行中的详情请求失效。
    reset() {
      this.formKey += 1;
      this.templateId = '';
      this.template = {};
      this.platformFields = { enabled: true, is_public: false, prewarm_count: 0 };
      this.loading = false;
      this.submitting = false;
      this.initSidebarFormData({});
    },
    // 启用、可见和预热不在共享表单里，未保存比较要一并带上。
    getDraftState() {
      return { ...this.$refs.form.getDraftState(), ...this.platformFields };
    },
    captureInitialState() {
      if (this.$refs.form) this.initSidebarFormData(this.getDraftState());
    },
    // 打开新建侧栏，表单挂载后记录未保存基线。
    async openCreate() {
      if (this.submitting) return;
      if (this.visible && !(await this.handleBeforeClose())) return;
      this.reset();
      this.visible = true;
      this.$emit('visibility-change', { visible: true, templateId: '' });
      await this.$nextTick();
      this.captureInitialState();
    },
    // 打开编辑侧栏并拉取详情，只回填仍属于这一次打开的响应。
    async openEdit(templateId) {
      if (this.submitting || !templateId) return;
      if (this.visible && !(await this.handleBeforeClose())) return;
      this.reset();
      // 再次打开会递增 formKey。返回时已不是这一次打开，就不再回填，也不改当前 loading。
      const openKey = this.formKey;
      this.templateId = templateId;
      this.visible = true;
      this.$emit('visibility-change', { visible: true, templateId });
      this.loading = true;
      try {
        const detail = await this.$store.dispatch('tenantConfig/getAgentSandboxTemplateDetail', { templateId });
        if (this.formKey !== openKey) return;
        this.template = detail;
        this.platformFields = {
          enabled: detail.enabled, is_public: detail.is_public, prewarm_count: detail.prewarm_count,
        };
        this.loading = false;
        await this.$nextTick();
        if (this.formKey !== openKey) return;
        // 表单要等 loading 结束才挂载，挂载后再记未保存基线。
        this.captureInitialState();
      } catch (error) {
        if (this.formKey !== openKey) return;
        this.visible = false;
        this.catchErrorHandler(error);
      } finally {
        if (this.formKey === openKey) this.loading = false;
      }
    },
    // 提交中不允许关闭；有未保存修改时先确认。
    async handleBeforeClose() {
      if (this.submitting) return false;
      // 加载中表单尚未挂载，没有可丢失的草稿。
      if (!this.visible || !this.$refs.form) return true;
      return this.$isSidebarClosed(JSON.stringify(this.getDraftState()));
    },
    async close() {
      if (await this.handleBeforeClose()) this.visible = false;
    },
    // 校验通过后连同平台字段提交，失败时保留侧栏和草稿。
    async save() {
      if (this.submitting || this.loading || !this.$refs.form) return;
      let data;
      try {
        data = await this.$refs.form.validate();
      } catch (error) {
        return;
      }
      this.submitting = true;
      try {
        // 数字输入框可能给出字符串；新建时 ID 来自表单，编辑时用已打开的模板。
        data = { ...data, ...this.platformFields, prewarm_count: Number(this.platformFields.prewarm_count) };
        const templateId = this.templateId || data.template_id;
        const action = this.isEdit ? 'updateAgentSandboxTemplate' : 'createAgentSandboxTemplate';
        await this.$store.dispatch(`tenantConfig/${action}`, { templateId, data });
        this.$paasMessage({ theme: 'success', message: this.$t('保存成功') });
        this.visible = false;
        this.$emit('saved');
      } catch (error) {
        this.catchErrorHandler(error);
      } finally {
        this.submitting = false;
      }
    },
  },
};
</script>

<style lang="scss">
.platform-sandbox-template-editor {
  .sandbox-template-form.bk-form-vertical .bk-label {
    width: 100% !important;
    height: auto !important;
  }
  .template-editor-header {
    display: flex;
    align-items: center;
    height: 52px;
    min-width: 0;
    > span:first-child {
      flex-shrink: 0;
    }
  }
  .template-editor-name {
    overflow: hidden;
    margin-left: 8px;
    padding-left: 8px;
    border-left: 1px solid #dcdee5;
    color: #979ba5;
    font-size: 14px;
    line-height: 18px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
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
  .prewarm-field > .bk-form-content {
    width: calc((100% - 16px) / 2);
  }
  .field-hint {
    margin: 6px 0 0;
    color: #979ba5;
    font-size: 12px;
    line-height: 18px;
    overflow-wrap: anywhere;
  }
}
</style>

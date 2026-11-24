<template>
  <div class="agent-sandbox-detail">
    <section class="ps-top-bar detail-header">
      <div class="back" @click="goBack">
        <i class="paasng-icon paasng-arrows-left icon-cls-back" />
        <span class="back-text">{{ $t('Agent 沙箱') }}</span>
      </div>
      <span class="divider" />
      <span class="detail-name">{{ template ? template.name || template.template_id : templateId }}</span>
    </section>
    <div class="app-container middle">
      <div v-bkloading="{ isLoading: loading, zIndex: 10 }" class="template-card card-style">
        <template v-if="template">
          <div class="template-heading">
            <h3>{{ $t('模板详情') }}</h3>
            <span v-if="sourceLabel" class="source-tag" :class="isCustom ? 'is-custom' : 'is-builtin'">
              {{ sourceLabel }}
            </span>
          </div>
          <dl class="template-fields">
            <template v-for="field in fields">
              <dt :key="`${field.key}-label`">{{ field.label }}</dt>
              <dd :key="field.key">
                <template-status
                  v-if="field.key === 'status'"
                  :status="template.status"
                  :message="template.status_message"
                />
                <template v-else>{{ field.value }}</template>
              </dd>
            </template>
          </dl>
          <div class="detail-actions">
            <bk-button theme="primary" @click="$refs.tools.openGuide(template.template_id)">
              {{ $t('接入示例') }}
            </bk-button>
            <bk-button @click="$refs.tools.openKeys()">API Keys</bk-button>
            <template v-if="isCustom">
              <bk-button @click="editTemplate">{{ $t('编辑') }}</bk-button>
              <bk-button @click="deleteTemplate">{{ $t('删除') }}</bk-button>
            </template>
          </div>
        </template>
      </div>
    </div>
    <sandbox-tools :key="appCode" ref="tools" :app-code="appCode" />
    <template-sideslider
      :key="`editor-${templateContext}`"
      ref="templateEditor"
      :app-code="appCode"
      @saved="loadTemplate"
    />
    <delete-template-dialog
      :key="`delete-${templateContext}`"
      ref="templateDelete"
      :app-code="appCode"
      @deleted="handleDeleted"
    />
  </div>
</template>

<script>
import SandboxTools from './comps/tools.vue';
import TemplateStatus from './comps/template-status.vue';
import TemplateSideslider from './comps/template-sideslider.vue';
import DeleteTemplateDialog from './comps/delete-template-dialog.vue';
import { formatTimeout } from './format';
import { isNil } from './utils';

export default {
  name: 'AgentSandboxTemplateDetail',
  components: { SandboxTools, TemplateStatus, TemplateSideslider, DeleteTemplateDialog },
  data() {
    return {
      template: null,
      loading: false,
      requestId: 0,
      requestPending: false,
      pollTimer: null,
      pageActive: true,
    };
  },
  computed: {
    appCode() {
      return this.$route.params.id;
    },
    templateId() {
      return this.$route.params.templateId;
    },
    templateContext() {
      return `${this.appCode}/${this.templateId}`;
    },
    isCustom() {
      return this.template?.is_builtin === false;
    },
    sourceLabel() {
      if (this.template?.is_builtin === true) return this.$t('平台预置');
      return this.isCustom ? this.$t('应用自建') : '';
    },
    fields() {
      const template = this.template;
      if (!template) return [];
      return [
        { key: 'template_id', label: `${this.$t('模板')} ID`, value: template.template_id },
        { key: 'name', label: this.$t('名称'), value: template.name },
        { key: 'status', label: this.$t('状态'), value: template.status },
        { key: 'description', label: this.$t('描述'), value: template.description },
        { key: 'image', label: this.$t('镜像'), value: template.image },
        { key: 'cpu_memory', label: this.$t('CPU / 内存'), value: this.formatCpuMemory(template) },
        { key: 'disk', label: this.$t('系统盘'), value: this.formatDisk(template) },
        { key: 'workdir', label: this.$t('工作目录'), value: template.workdir },
        { key: 'env_vars', label: this.$t('环境变量'), value: this.environmentVariables },
        {
          key: 'prewarm_count',
          label: template.is_builtin ? this.$t('每集群预热') : this.$t('预热'),
          value: template.prewarm_count,
        },
        { key: 'timeout', label: this.$t('生命周期 TTL'), value: formatTimeout(template.timeout) },
        { key: 'network', label: this.$t('网络'), value: template.network },
        { key: 'region', label: this.$t('地域'), value: template.region },
        { key: 'created', label: this.$t('创建时间'), value: template.created },
        { key: 'updated', label: this.$t('更新时间'), value: template.updated },
      ].filter(({ key }) => {
        if (key === 'status' || key === 'disk') return true;
        if (key === 'cpu_memory') {
          return [template.cpu_count, template.memory_mb].some(value => !isNil(value) && value !== '');
        }
        if (key === 'env_vars') return this.environmentVariables !== '';
        const value = template[key];
        return !isNil(value) && value !== '';
      });
    },
    environmentVariables() {
      return Object.entries(this.template?.env_vars || {})
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');
    },
  },
  watch: {
    templateContext: {
      immediate: true,
      handler: 'loadTemplate',
    },
  },
  mounted() {
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  },
  beforeDestroy() {
    this.pageActive = false;
    this.requestId += 1;
    this.stopPolling();
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
  },
  methods: {
    loadTemplate() {
      return this.fetchTemplate(false);
    },
    refreshTemplate() {
      if (this.requestPending || document.hidden || !this.pageActive) return;
      return this.fetchTemplate(true);
    },
    stopPolling() {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    },
    schedulePolling() {
      this.stopPolling();
      if (this.pageActive && !document.hidden && this.template?.status === 'syncing') {
        this.pollTimer = setTimeout(this.refreshTemplate, 5000);
      }
    },
    handleVisibilityChange() {
      if (document.hidden) {
        this.stopPolling();
      } else if (this.template?.status === 'syncing') {
        this.refreshTemplate();
      }
    },
    async fetchTemplate(background) {
      this.stopPolling();
      this.requestId += 1;
      const requestId = this.requestId;
      const context = this.templateContext;
      if (!background) this.template = null;
      this.loading = !background;
      this.requestPending = true;
      try {
        const result = await this.$store.dispatch('agentSandbox/getTemplate', {
          appCode: this.appCode,
          templateId: this.templateId,
        });
        if (requestId !== this.requestId || context !== this.templateContext) return;
        if (!result) throw new Error(this.$t('加载失败，请重试'));
        this.template = result;
        this.schedulePolling();
      } catch (error) {
        if (requestId !== this.requestId || context !== this.templateContext) return;
        this.catchErrorHandler(error);
      } finally {
        if (requestId === this.requestId && context === this.templateContext) {
          this.loading = false;
          this.requestPending = false;
        }
      }
    },
    formatCpuMemory(template) {
      const parts = [];
      if (!isNil(template.cpu_count) && template.cpu_count !== '') {
        parts.push(this.$t('{count} 核', { count: template.cpu_count }));
      }
      if (!isNil(template.memory_mb) && template.memory_mb !== '') {
        const gigabytes = Number(template.memory_mb) / 1024;
        const memory = Number.isInteger(gigabytes) ? `${gigabytes}` : `${Number(gigabytes.toFixed(2))}`;
        parts.push(`${memory} GB`);
      }
      return parts.join(' / ');
    },
    formatDisk(template) {
      const size = Number(template.disk_size_mb);
      if (!size) return this.$t('默认根文件系统');
      const gigabytes = size / 1024;
      const memory = Number.isInteger(gigabytes) ? `${gigabytes}` : `${Number(gigabytes.toFixed(2))}`;
      return `${size} MB (${memory} GB)`;
    },
    editTemplate() {
      if (this.isCustom) this.$refs.templateEditor.openEdit(this.templateId);
    },
    deleteTemplate() {
      if (this.isCustom) this.$refs.templateDelete.open(this.template);
    },
    handleDeleted(templateId) {
      if (templateId === this.templateId) this.goBack();
    },
    goBack() {
      this.$router.push({
        name: 'agentSandbox',
        params: { id: this.appCode },
        query: { tab: this.$route.query.tab === 'instances' ? 'instances' : 'templates' },
      });
    },
  },
};
</script>

<style lang="scss" scoped>
.detail-header {
  display: flex;
  align-items: center;
  height: 52px;
  padding: 0 24px;
  line-height: 1;
}
.app-container {
  padding-top: 24px;
}
.back {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  color: #313238;
  font-size: 16px;
  cursor: pointer;
  .icon-cls-back {
    margin-right: 5px;
    color: #3a84ff;
    font-size: 18px;
    font-weight: 700;
  }
}
.divider {
  flex-shrink: 0;
  width: 1px;
  height: 14px;
  margin: 0 8px;
  background-color: #dcdee5;
}
.detail-name {
  min-width: 0;
  overflow: hidden;
  color: #979ba5;
  font-size: 14px;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.template-card {
  min-height: 300px;
  padding: 24px;
  background: #fff;
  h3 {
    margin: 0;
    color: #313238;
    font-size: 14px;
    font-weight: bold;
    line-height: 22px;
  }
}
.template-heading {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
}
.source-tag {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 8px;
  border-radius: 2px;
  font-size: 12px;
  line-height: 20px;
  &.is-custom {
    color: #3a84ff;
    background: #e1ecff;
  }
  &.is-builtin {
    color: #63656e;
    background: #f0f1f5;
  }
}
.template-fields {
  display: grid;
  grid-template-columns: 120px minmax(0, 1fr);
  row-gap: 12px;
  margin: 0;
  font-size: 12px;
  line-height: 20px;
  dt,
  dd {
    padding: 6px 0;
  }
  dt {
    color: #979ba5;
    text-align: right;
    &::after {
      content: '：';
    }
  }
  dd {
    margin-left: 0;
    color: #313238;
    overflow-wrap: anywhere;
    white-space: pre-wrap;
  }
}
.detail-actions {
  display: flex;
  gap: 12px;
  margin: 24px 0 0 120px;
}
</style>

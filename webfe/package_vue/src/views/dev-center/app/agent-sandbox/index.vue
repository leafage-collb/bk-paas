<template>
  <div class="agent-sandbox-page">
    <cloud-app-top-bar
      class="sandbox-navigation"
      :nav-list="tabPanels"
      :active="activeTab"
      @change="changeTab"
    >
      <div slot="title" class="sandbox-title">
        <span>{{ $t('Agent 沙箱') }}</span>
        <span class="sandbox-subtitle">
          {{ $t('兼容 E2B，为 Agent 提供隔离的代码与浏览器运行环境。') }}
        </span>
      </div>
      <bk-button slot="right" class="f12" theme="primary" outline @click="$refs.tools.openKeys()">
        API Keys
      </bk-button>
    </cloud-app-top-bar>
    <div class="app-container middle">
      <div class="sandbox-card card-style">
        <template v-if="activeTab === 'instances'">
          <bk-alert
            type="info"
            class="sandbox-notice"
            :title="$t('沙箱需通过 SDK 或 HTTP API 创建，请参考「沙箱模板」的「接入示例」。')"
          />
          <div class="sandbox-toolbar">
            <bk-input
              v-model="instanceSearch"
              :placeholder="$t('搜索沙箱 ID、模板、状态')"
              clearable
              right-icon="bk-icon icon-search"
              class="sandbox-search"
            />
          </div>
          <bk-table
            :key="`instances-${appCode}`"
            ref="instanceTable"
            class="sandbox-table"
            :outer-border="false"
            v-bkloading="{ isLoading: instanceLoading, zIndex: 10 }"
            :data="pagedInstances"
            :pagination="instancePagination"
            @page-change="instancePage = $event"
            @page-limit-change="changeInstanceLimit"
            @filter-change="changeInstanceFilters"
          >
            <bk-table-column :label="$t('沙箱 ID')" prop="sandbox_id" min-width="180" show-overflow-tooltip />
            <bk-table-column
              :label="$t('模板')"
              prop="template_id"
              column-key="template_id"
              min-width="140"
              :filters="templateFilters"
              :filtered-value="templateFilter ? [templateFilter] : []"
              :filter-multiple="false"
              show-overflow-tooltip
            >
              <template slot-scope="{ row }">
                <bk-button
                  v-if="visibleTemplateIds.includes(row.template_id)"
                  text
                  theme="primary"
                  @click="openTemplate(row.template_id)"
                >{{ row.template_id }}</bk-button>
                <span v-else>{{ displayValue(row.template_id) }}</span>
              </template>
            </bk-table-column>
            <bk-table-column
              :label="$t('状态')"
              prop="state"
              column-key="state"
              width="120"
              :filters="stateOptions"
              :filtered-value="stateFilter ? [stateFilter] : []"
              :filter-multiple="false"
            >
              <template slot-scope="{ row }">
                <span :class="['sandbox-state', row.state]" />{{ stateLabel(row.state) }}
              </template>
            </bk-table-column>
            <bk-table-column :label="$t('资源')" width="150">
              <template slot-scope="{ row }">
                <span v-bk-tooltips="resourceTooltip(row)" class="resource-value">{{ formatResources(row) }}</span>
              </template>
            </bk-table-column>
            <bk-table-column :label="$t('启动时间')" width="120">
              <template slot-scope="{ row }">
                <span v-bk-tooltips="displayValue(row.started_at)">{{ formatRelativeTime(row.started_at) }}</span>
              </template>
            </bk-table-column>
            <bk-table-column :label="$t('过期时间')" width="120">
              <template slot-scope="{ row }">
                <span v-bk-tooltips="displayValue(row.end_at)">{{ formatRelativeTime(row.end_at) }}</span>
              </template>
            </bk-table-column>
            <bk-table-column :label="$t('操作')" width="120">
              <template slot-scope="{ row }">
                <bk-button text theme="primary" :disabled="destroying" @click="confirmDestroy(row)">
                  {{ $t('销毁') }}
                </bk-button>
              </template>
            </bk-table-column>
            <div slot="empty">
              <table-empty
                :condition="{ instanceSearch, templateFilter, stateFilter }"
                @clear-filter="clearInstanceFilters"
              />
            </div>
          </bk-table>
        </template>
        <template v-else>
          <div class="sandbox-toolbar template-toolbar">
            <bk-button theme="primary" icon="plus" @click="$refs.templateEditor.openCreate()">
              {{ $t('新建模板') }}
            </bk-button>
            <bk-input
              v-model="templateSearch"
              :placeholder="$t('搜索模板名称、模板 ID、镜像地址')"
              clearable
              right-icon="bk-icon icon-search"
              class="sandbox-search"
            />
          </div>
          <bk-table
            :key="`templates-${appCode}`"
            ref="templateTable"
            class="sandbox-table"
            :outer-border="false"
            v-bkloading="{ isLoading: templateLoading, zIndex: 10 }"
            :data="pagedTemplates"
            :pagination="showTemplatePagination ? templatePagination : {}"
            @page-change="templatePage = $event"
            @page-limit-change="changeTemplateLimit"
            @filter-change="changeTemplateFilters"
          >
            <bk-table-column :label="$t('沙箱模板')" min-width="190">
              <template slot-scope="{ row }">
                <div class="template-name-cell">
                  <bk-button
                    text
                    theme="primary"
                    class="template-name"
                    v-bk-overflow-tips
                    @click="openTemplate(row.template_id)"
                  >{{ row.name || row.template_id }}</bk-button>
                  <span class="template-id">
                    <span class="template-id-text" v-bk-overflow-tips>{{ row.template_id }}</span>
                    <bk-button text theme="primary" class="template-copy" v-copy="row.template_id">
                      <i class="paasng-icon paasng-general-copy" :title="$t('复制')" />
                    </bk-button>
                  </span>
                </div>
              </template>
            </bk-table-column>
            <bk-table-column
              :label="$t('来源')"
              column-key="is_builtin"
              width="110"
              :filters="sourceOptions"
              :filtered-value="sourceFilter ? [sourceFilter] : []"
              :filter-multiple="false"
            >
              <template slot-scope="{ row }">
                {{ sourceLabel(row) }}
              </template>
            </bk-table-column>
            <bk-table-column :label="$t('镜像')" prop="image" min-width="200" show-overflow-tooltip />
            <bk-table-column :label="$t('描述')" min-width="180" show-overflow-tooltip>
              <template slot-scope="{ row }">{{ displayValue(row.description) }}</template>
            </bk-table-column>
            <bk-table-column :label="$t('资源')" min-width="160">
              <template slot-scope="{ row }">
                <span v-bk-tooltips="resourceTooltip(row)" class="resource-value">{{ formatResources(row) }}</span>
              </template>
            </bk-table-column>
            <bk-table-column :label="$t('状态')" width="120">
              <template slot-scope="{ row }">
                <template-status :status="row.status" :message="row.status_message" />
              </template>
            </bk-table-column>
            <bk-table-column :label="$t('操作')" width="190">
              <template slot-scope="{ row }">
                <div class="template-actions">
                  <bk-button text theme="primary" @click="$refs.tools.openGuide(row.template_id)">
                    {{ $t('接入示例') }}
                  </bk-button>
                  <template v-if="row.is_builtin === false">
                    <bk-button text theme="primary" @click="$refs.templateEditor.openEdit(row.template_id)">
                      {{ $t('编辑') }}
                    </bk-button>
                    <bk-button text theme="primary" @click="$refs.templateDelete.open(row)">
                      {{ $t('删除') }}
                    </bk-button>
                  </template>
                </div>
              </template>
            </bk-table-column>
            <div slot="empty">
              <table-empty
                :condition="{ templateSearch, sourceFilter }"
                @clear-filter="clearTemplateFilters"
              />
            </div>
          </bk-table>
        </template>
      </div>
    </div>
    <sandbox-tools :key="appCode" ref="tools" :app-code="appCode" />
    <template-sideslider ref="templateEditor" :app-code="appCode" @saved="handleTemplateSaved" />
    <delete-template-dialog ref="templateDelete" :app-code="appCode" @deleted="handleTemplateDeleted" />
    <bk-dialog
      v-model="destroyDialogVisible"
      class="sandbox-destroy-dialog"
      :mask-close="false"
      :width="480"
      :title="$t('是否销毁该沙箱？')"
      footer-position="center"
    >
      <p class="destroy-id">
        <span class="destroy-label">{{ $t('沙箱 ID') }}：</span>{{ destroyTarget && destroyTarget.sandbox_id }}
      </p>
      <div class="destroy-tips">{{ $t('销毁后将无法恢复，请谨慎操作') }}</div>
      <div slot="footer" class="footer-wrapper">
        <bk-button theme="danger" :loading="destroying" @click="destroySandbox">{{ $t('销毁') }}</bk-button>
        <bk-button :disabled="destroying" @click="destroyDialogVisible = false">{{ $t('取消') }}</bk-button>
      </div>
    </bk-dialog>
  </div>
</template>

<script>
import SandboxTools from './comps/tools.vue';
import TemplateSideslider from './comps/template-sideslider.vue';
import TemplateStatus from './comps/template-status.vue';
import DeleteTemplateDialog from './comps/delete-template-dialog.vue';
import CloudAppTopBar from '@/components/cloud-app-top-bar.vue';
import { filterListByKeywordInFields } from '@/common/utils';
import { displayValue, formatMemory, formatResources, formatRelativeTime } from './format';
import { clampPage, isEmptyResponse, DEFAULT_PAGE_LIMIT } from './utils';

export default {
  name: 'AgentSandbox',
  components: { SandboxTools, CloudAppTopBar, TemplateSideslider, TemplateStatus, DeleteTemplateDialog },
  data() {
    return {
      instances: [],
      templates: [],
      instanceLoading: false,
      templateLoading: false,
      instanceRequest: 0,
      templateRequest: 0,
      templateRequestPending: false,
      // 应用切换或组件销毁时递增，使在途的销毁操作失效
      contextVersion: 0,
      instanceTemplateIds: [],
      instanceSearch: '',
      templateSearch: '',
      sourceFilter: '',
      templatePollTimer: null,
      templateFilter: '',
      stateFilter: '',
      instancePage: 1,
      templatePage: 1,
      instanceLimit: DEFAULT_PAGE_LIMIT,
      templateLimit: DEFAULT_PAGE_LIMIT,
      destroyDialogVisible: false,
      destroyTarget: null,
      destroying: false,
    };
  },
  computed: {
    tabPanels() {
      return [
        { name: 'instances', label: this.$t('沙箱实例') },
        { name: 'templates', label: this.$t('沙箱模板') },
      ];
    },
    appCode() {
      return this.$route.params.id;
    },
    activeTab() {
      return this.$route.query.tab === 'templates' ? 'templates' : 'instances';
    },
    visibleTemplateIds() {
      return this.templates.map(template => template.template_id);
    },
    templateOptions() {
      return [...new Set([
        ...this.visibleTemplateIds,
        ...this.instanceTemplateIds,
        this.templateFilter,
      ])].filter(Boolean).sort();
    },
    templateFilters() {
      return this.templateOptions.map(id => ({ text: id, value: id }));
    },
    stateLabelMap() {
      return { running: this.$t('运行中'), paused: this.$t('已暂停') };
    },
    stateOptions() {
      return [...new Set(['running', 'paused', ...this.instances.map(instance => instance.state)])]
        .filter(Boolean)
        .map(state => ({ text: this.stateLabel(state), value: state }));
    },
    sourceOptions() {
      return [
        { text: this.$t('平台预置'), value: 'builtin' },
        { text: this.$t('应用自建'), value: 'custom' },
      ];
    },
    filteredInstances() {
      const list = this.instances
        .filter(instance => !this.stateFilter || instance.state === this.stateFilter)
        .map(instance => ({ ...instance, stateLabel: this.stateLabel(instance.state) }));
      return filterListByKeywordInFields(list, this.instanceSearch, ['sandbox_id', 'template_id', 'state', 'stateLabel']);
    },
    pagedInstances() {
      const start = (this.instancePage - 1) * this.instanceLimit;
      return this.filteredInstances.slice(start, start + this.instanceLimit);
    },
    filteredTemplates() {
      const list = this.templates.filter((template) => {
        if (!this.sourceFilter) return true;
        return this.sourceFilter === 'custom' ? template.is_builtin === false : template.is_builtin === true;
      });
      return filterListByKeywordInFields(list, this.templateSearch, ['name', 'template_id', 'image']);
    },
    pagedTemplates() {
      const start = (this.templatePage - 1) * this.templateLimit;
      return this.filteredTemplates.slice(start, start + this.templateLimit);
    },
    instancePagination() {
      return {
        current: this.instancePage,
        limit: this.instanceLimit,
        count: this.filteredInstances.length,
        showTotalCount: true,
      };
    },
    templatePagination() {
      return { current: this.templatePage, limit: this.templateLimit, count: this.filteredTemplates.length };
    },
    showTemplatePagination() {
      return this.filteredTemplates.length > DEFAULT_PAGE_LIMIT;
    },
  },
  watch: {
    appCode: {
      immediate: true,
      handler() {
        this.resetApplication();
        this.loadInstances();
        this.loadTemplates();
      },
    },
    activeTab() {
      this.stopTemplatePolling();
      if (this.activeTab === 'templates') this.loadTemplates();
      else this.loadInstances();
    },
    instanceSearch() {
      this.instancePage = 1;
    },
    stateFilter() {
      this.instancePage = 1;
    },
    templateSearch() {
      this.templatePage = 1;
    },
    sourceFilter() {
      this.templatePage = 1;
    },
  },
  mounted() {
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  },
  beforeDestroy() {
    this.stopTemplatePolling();
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    this.contextVersion += 1;
    this.instanceRequest += 1;
    this.templateRequest += 1;
  },
  methods: {
    displayValue,
    formatResources,
    formatRelativeTime,
    // 实例与模板各自维护请求序列，此处仅校验应用上下文是否仍然有效
    isCurrentContext(contextVersion) {
      return this.contextVersion === contextVersion;
    },
    resetApplication() {
      this.stopTemplatePolling();
      this.contextVersion += 1;
      this.instanceRequest += 1;
      this.templateRequest += 1;
      this.instances = [];
      this.instanceTemplateIds = [];
      this.templates = [];
      this.templateRequestPending = false;
      this.instanceSearch = '';
      this.templateSearch = '';
      this.sourceFilter = '';
      this.templateFilter = '';
      this.stateFilter = '';
      this.instancePage = 1;
      this.templatePage = 1;
      this.destroyDialogVisible = false;
      this.destroyTarget = null;
      this.destroying = false;
    },
    async loadInstances() {
      const appCode = this.appCode;
      if (!appCode) return;
      this.instanceRequest += 1;
      const request = this.instanceRequest;
      this.instanceLoading = true;
      try {
        const result = await this.$store.dispatch('agentSandbox/listSandboxes', {
          appCode,
          templateId: this.templateFilter,
        });
        if (request !== this.instanceRequest || appCode !== this.appCode) return;
        if (!Array.isArray(result)) throw new Error(this.$t('加载失败，请重试'));
        this.instances = result;
        this.instanceTemplateIds = [...new Set([
          ...this.instanceTemplateIds,
          ...result.map(instance => instance.template_id),
        ])];
        this.instancePage = clampPage(this.instancePage, this.filteredInstances.length, this.instanceLimit);
      } catch (error) {
        if (request !== this.instanceRequest || appCode !== this.appCode) return;
        this.instances = [];
        this.catchErrorHandler(error);
      } finally {
        if (request === this.instanceRequest && appCode === this.appCode) this.instanceLoading = false;
      }
    },
    async loadTemplates(silent = false) {
      const appCode = this.appCode;
      if (!appCode || (silent && this.templateRequestPending)) return;
      this.stopTemplatePolling();
      this.templateRequest += 1;
      const request = this.templateRequest;
      this.templateRequestPending = true;
      if (!silent) this.templateLoading = true;
      try {
        const result = await this.$store.dispatch('agentSandbox/listTemplates', { appCode });
        if (request !== this.templateRequest || appCode !== this.appCode) return;
        if (!Array.isArray(result)) throw new Error(this.$t('加载失败，请重试'));
        this.templates = result;
        this.templatePage = clampPage(this.templatePage, this.filteredTemplates.length, this.templateLimit);
        this.scheduleTemplatePolling();
      } catch (error) {
        if (request !== this.templateRequest || appCode !== this.appCode) return;
        // 轮询失败保持静默，避免反复弹窗
        if (!silent) {
          this.templates = [];
          this.catchErrorHandler(error);
        }
      } finally {
        if (request === this.templateRequest && appCode === this.appCode) {
          this.templateLoading = false;
          this.templateRequestPending = false;
        }
      }
    },
    stopTemplatePolling() {
      clearTimeout(this.templatePollTimer);
      this.templatePollTimer = null;
    },
    scheduleTemplatePolling() {
      this.stopTemplatePolling();
      if (document.hidden || this.activeTab !== 'templates' || !this.templates.some(row => row.status === 'syncing')) {
        return;
      }
      this.templatePollTimer = setTimeout(() => this.loadTemplates(true), 5000);
    },
    handleVisibilityChange() {
      if (document.hidden) this.stopTemplatePolling();
      else if (this.activeTab === 'templates' && this.templates.some(row => row.status === 'syncing')) {
        this.loadTemplates(true);
      }
    },
    handleTemplateSaved() {
      this.loadTemplates();
    },
    handleTemplateDeleted() {
      this.loadTemplates();
    },
    changeTab(tab) {
      if (tab === this.activeTab) return;
      this.$router.replace({ query: { ...this.$route.query, tab } });
    },
    changeInstanceFilters(filters) {
      this.instancePage = 1;
      if (Object.prototype.hasOwnProperty.call(filters, 'state')) {
        this.stateFilter = filters.state[0] || '';
      }
      if (Object.prototype.hasOwnProperty.call(filters, 'template_id')) {
        const templateId = filters.template_id[0] || '';
        if (templateId !== this.templateFilter) {
          this.templateFilter = templateId;
          this.loadInstances();
        }
      }
    },
    clearInstanceFilters() {
      const hadTemplate = !!this.templateFilter;
      this.instanceSearch = '';
      this.stateFilter = '';
      this.templateFilter = '';
      this.instancePage = 1;
      this.$refs.instanceTable.clearFilter();
      if (hadTemplate) this.loadInstances();
    },
    changeTemplateFilters(filters) {
      if (Object.prototype.hasOwnProperty.call(filters, 'is_builtin')) {
        this.sourceFilter = filters.is_builtin[0] || '';
      }
    },
    clearTemplateFilters() {
      this.templateSearch = '';
      this.sourceFilter = '';
      this.templatePage = 1;
      this.$refs.templateTable.clearFilter();
    },
    changeInstanceLimit(limit) {
      this.instanceLimit = limit;
      this.instancePage = 1;
    },
    changeTemplateLimit(limit) {
      this.templateLimit = limit;
      this.templatePage = 1;
    },
    stateLabel(state) {
      return this.stateLabelMap[state] || displayValue(state);
    },
    sourceLabel(template) {
      if (template.is_builtin === true) return this.$t('平台预置');
      return template.is_builtin === false ? this.$t('应用自建') : '--';
    },
    resourceTooltip(row) {
      return `CPU: ${displayValue(row.cpu_count)} / ${this.$t('内存')}: ${formatMemory(row.memory_mb)}`
        + ` / ${this.$t('磁盘')}: ${formatMemory(row.disk_size_mb)}`;
    },
    openTemplate(templateId) {
      this.$router.push({
        name: 'agentSandboxTemplateDetail',
        params: { id: this.appCode, templateId },
        query: { tab: this.activeTab },
      });
    },
    confirmDestroy(row) {
      this.destroyTarget = row;
      this.destroyDialogVisible = true;
    },
    async destroySandbox() {
      if (this.destroying || !this.destroyTarget) return;
      const appCode = this.appCode;
      const { contextVersion } = this;
      this.destroying = true;
      try {
        const result = await this.$store.dispatch('agentSandbox/destroySandbox', {
          appCode,
          sandboxId: this.destroyTarget.sandbox_id,
        });
        if (!this.isCurrentContext(contextVersion)) return;
        if (!isEmptyResponse(result)) throw new Error(this.$t('销毁失败'));
        this.destroyDialogVisible = false;
        this.destroyTarget = null;
        this.$paasMessage({ theme: 'success', message: this.$t('销毁成功') });
        await this.loadInstances();
      } catch (error) {
        if (!this.isCurrentContext(contextVersion)) return;
        this.catchErrorHandler(error);
        if (error.status === 404) {
          this.destroyDialogVisible = false;
          this.destroyTarget = null;
          await this.loadInstances();
        }
      } finally {
        if (this.isCurrentContext(contextVersion)) this.destroying = false;
      }
    },
  },
};
</script>

<style lang="scss" scoped>
.sandbox-navigation {
  /deep/ .bk-tab-label-wrapper .bk-tab-label-list .bk-tab-label-item {
    min-width: 100px;
    padding: 0 18px;
  }
}
.sandbox-title {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
  margin-right: 112px;
  white-space: nowrap;
}
.sandbox-subtitle {
  overflow: hidden;
  margin-left: 16px;
  color: #979ba5;
  font-size: 12px;
}
.sandbox-card {
  padding: 24px;
  background: #fff;
}
.sandbox-toolbar {
  display: flex;
  justify-content: flex-end;
  margin: 16px 0;
}
.template-toolbar {
  justify-content: space-between;
  gap: 16px;
  margin-top: 0;
}
.template-name-cell {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 0;
  line-height: 22px;
}
.template-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}
.template-name {
  max-width: 100%;
  overflow: hidden;
  font-weight: 400;
  text-overflow: ellipsis;
  white-space: nowrap;
  ::v-deep > span {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}
.template-id {
  display: flex;
  align-items: center;
  max-width: 100%;
  color: #979ba5;
  .template-id-text {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .template-copy {
    flex: none;
    margin-left: 6px;
    opacity: 0;
  }
  &:hover .template-copy,
  &:focus-within .template-copy {
    opacity: 1;
  }
}
.sandbox-notice {
  /deep/ .bk-alert-wraper {
    align-items: center;
  }
}
.sandbox-search {
  width: 420px;
  max-width: 100%;
}
.sandbox-table {
  /deep/ td {
    height: 56px;
  }
  /deep/ .bk-button-text {
    font-size: 12px;
  }
}
.resource-value {
  border-bottom: 1px dashed #979ba5;
  cursor: help;
}
.sandbox-state {
  display: inline-block;
  width: 8px;
  height: 8px;
  margin-right: 6px;
  border-radius: 50%;
  background: #979ba5;
  &.running {
    background: #2dcb56;
  }
}
.sandbox-destroy-dialog {
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
  }
  .destroy-id {
    margin: 0;
    word-break: break-all;
  }
  .destroy-label,
  .destroy-tips {
    color: #63656e;
  }
  .destroy-tips {
    padding: 12px;
    margin-top: 12px;
    line-height: 22px;
    background: #f5f6fa;
    border-radius: 2px;
  }
}
</style>

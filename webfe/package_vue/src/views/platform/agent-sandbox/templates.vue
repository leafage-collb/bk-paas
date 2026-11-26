<template>
  <div class="platform-sandbox-templates">
    <bk-alert
      type="info"
      class="templates-notice"
      :title="$t('此处管理的沙箱模板全平台共享。已启用且开启「开发者中心可见」的模板会展示在各应用的 Agent 沙箱模板列表中。')"
    />
    <div class="templates-toolbar">
      <bk-button theme="primary" icon="plus" @click="$refs.editor.openCreate()">{{ $t('新建模板') }}</bk-button>
      <div class="templates-tools">
        <bk-input
          v-model="search"
          :placeholder="$t('搜索模板名称、ID、镜像、描述、状态')"
          clearable
          right-icon="bk-icon icon-search"
          class="templates-search"
        />
      </div>
    </div>
    <bk-table
      v-bkloading="{ isLoading: loading, zIndex: 10 }"
      :data="pagedTemplates"
      :pagination="pagination"
      :outer-border="false"
      row-key="template_id"
      @page-change="page = $event"
      @page-limit-change="changeLimit"
    >
      <bk-table-column :label="$t('沙箱模板')" min-width="180">
        <template slot-scope="{ row }">
          <div class="template-name" v-bk-overflow-tips>{{ row.name || row.template_id }}</div>
          <div class="template-id" v-bk-overflow-tips>{{ row.template_id }}</div>
        </template>
      </bk-table-column>
      <bk-table-column :label="$t('描述')" prop="description" min-width="160" show-overflow-tooltip>
        <template slot-scope="{ row }">{{ displayValue(row.description) }}</template>
      </bk-table-column>
      <bk-table-column :label="$t('镜像')" prop="image" min-width="200" show-overflow-tooltip />
      <bk-table-column :label="$t('资源')" min-width="150">
        <template slot-scope="{ row }">
          <span v-bk-tooltips="resourceTooltip(row)" class="column-help">{{ formatResources(row) }}</span>
        </template>
      </bk-table-column>
      <bk-table-column :label="$t('每集群预热')" prop="prewarm_count" width="100" />
      <bk-table-column
        :label="$t('开发者中心可见')"
        prop="is_public"
        width="150"
        :render-header="renderColumnHeader"
      >
        <template slot-scope="{ row }">
          <bk-switcher
            v-model="row.is_public"
            theme="primary"
            :disabled="isRowBusy(row.template_id)"
            @change="value => changeSwitch(row, 'is_public', value)"
          />
        </template>
      </bk-table-column>
      <bk-table-column
        :label="$t('是否启用')"
        prop="enabled"
        width="100"
        :render-header="renderColumnHeader"
      >
        <template slot-scope="{ row }">
          <bk-switcher
            v-model="row.enabled"
            theme="primary"
            :disabled="isRowBusy(row.template_id)"
            @change="value => changeSwitch(row, 'enabled', value)"
          />
        </template>
      </bk-table-column>
      <bk-table-column
        :label="$t('状态')"
        prop="status"
        min-width="100"
        :render-header="renderColumnHeader"
      >
        <template slot-scope="{ row }">
          <span :class="['template-status', statusClass(row)]">
            <span class="status-dot" />{{ statusLabel(row) }}
          </span>
        </template>
      </bk-table-column>
      <bk-table-column :label="$t('操作')" width="115" fixed="right">
        <template slot-scope="{ row }">
          <bk-button text theme="primary" :disabled="isRowBusy(row.template_id)" @click="openEdit(row)">
            {{ $t('编辑') }}
          </bk-button>
          <bk-button text theme="primary" :disabled="isRowBusy(row.template_id)" @click="confirmDelete(row)">
            {{ $t('删除') }}
          </bk-button>
        </template>
      </bk-table-column>
      <div slot="empty">
        <table-empty
          :condition="{
            search,
            visibility: visibilityFilter === 'all' ? '' : visibilityFilter,
            status: statusFilter === 'all' ? '' : statusFilter,
          }"
          @clear-filter="clearFilters"
        />
      </div>
    </bk-table>
    <template-sideslider
      ref="editor"
      @saved="refresh()"
      @visibility-change="editorVisibilityChanged"
    />
  </div>
</template>

<script>
import TableHeaderFilters from '@/components/teble-header-filters';
import TableEmpty from '@/components/ui/table-empty';
import { displayValue, formatResources as formatSandboxResources } from '@/views/dev-center/app/agent-sandbox/format';
import { clampPage } from '@/views/dev-center/app/agent-sandbox/utils';
import TemplateSideslider from './comps/template-sideslider.vue';
import { getTemplatePayload } from './template-utils';

export default {
  name: 'PlatformSandboxTemplates',
  components: { TableEmpty, TemplateSideslider },
  data() {
    return {
      templates: [],
      syncTemplates: [],
      search: '',
      visibilityFilter: 'all',
      statusFilter: 'all',
      page: 1,
      limit: 10,
      loading: false,
      busyRows: {},
      editorTemplateId: '',
      timer: null,
    };
  },
  computed: {
    visibilityOptions() {
      return [
        { text: this.$t('全部'), value: 'all' },
        { text: this.$t('公开可见'), value: 'public' },
        { text: this.$t('仅 ID 调用'), value: 'id' },
      ];
    },
    statusOptions() {
      return [
        { text: this.$t('全部'), value: 'all' },
        { text: this.$t('可用'), value: 'succeeded' },
        { text: this.$t('下发中'), value: 'pending' },
        { text: this.$t('下发失败'), value: 'failed' },
        { text: this.$t('已停用'), value: 'disabled' },
      ];
    },
    filteredTemplates() {
      const search = this.search.trim().toLowerCase();
      return this.templates.filter((row) => {
        if (this.visibilityFilter === 'public' && row.is_public !== true) return false;
        if (this.visibilityFilter === 'id' && row.is_public !== false) return false;
        if (this.statusFilter !== 'all' && this.statusClass(row) !== this.statusFilter) return false;
        return !search || [
          row.name, row.template_id, row.image, row.description, this.statusLabel(row),
        ].some(value => String(value || '').toLowerCase()
          .includes(search));
      });
    },
    pagedTemplates() {
      return this.filteredTemplates.slice((this.page - 1) * this.limit, this.page * this.limit);
    },
    pagination() {
      return {
        current: this.page, count: this.filteredTemplates.length, limit: this.limit,
        limitList: [10, 20, 50, 100], showTotalCount: true,
      };
    },
    // 只关联内置、且集群资源名等于模板 ID 的同步记录。
    syncStatusById() {
      return Object.fromEntries(this.syncTemplates
        .filter(row => row.is_builtin === true && row.resource_name === row.template_id)
        .map(row => [row.template_id, row]));
    },
  },
  watch: {
    search() {
      this.page = 1;
    },
    visibilityFilter() {
      this.page = 1;
    },
    statusFilter() {
      this.page = 1;
    },
    filteredTemplates(rows) {
      this.page = clampPage(this.page, rows.length, this.limit);
    },
  },
  created() {
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    this.refresh();
  },
  beforeDestroy() {
    this.clearTimer();
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
  },
  methods: {
    displayValue,
    // 表头提示走 render-header，slot="header" 不会渲染。
    renderColumnHeader(h, data) {
      if (data.column.property === 'is_public') {
        return h(TableHeaderFilters, {
          props: {
            active: this.visibilityFilter,
            label: data.column.label,
            iconClass: 'bk-icon icon-funnel',
            tips: this.$t('开启后在所有应用的 Agent 沙箱模板列表中展示；关闭后不在页面展示，但已知 templateID 的调用方仍可通过 SDK 使用。'),
            tipsWidth: 280,
            filterList: this.visibilityOptions,
          },
          on: {
            'filter-change': (item) => {
              this.visibilityFilter = item.value;
            },
          },
        });
      }
      if (data.column.property === 'status') {
        return h(TableHeaderFilters, {
          props: {
            active: this.statusFilter,
            label: data.column.label,
            iconClass: 'bk-icon icon-funnel',
            filterList: this.statusOptions,
          },
          on: {
            'filter-change': (item) => {
              this.statusFilter = item.value;
            },
          },
        });
      }
      const directive = {
        name: 'bkTooltips',
        content: this.$t('停用后，SDK 与 API 将无法再使用该模板创建新的沙箱实例。'),
        placement: 'top',
        width: 240,
      };
      return (
        <span class="custom-header-cell" v-bk-tooltips={directive}>
          {data.column.label}
        </span>
      );
    },
    clearFilters() {
      this.search = '';
      this.visibilityFilter = 'all';
      this.statusFilter = 'all';
    },
    formatResources(resource) {
      // 平台文案使用 GB，共享格式化仍返回 GiB。
      return formatSandboxResources(resource).replace(/GiB/g, 'GB');
    },
    beforeLeave() {
      return this.$refs.editor ? this.$refs.editor.handleBeforeClose() : true;
    },
    clearTimer() {
      clearTimeout(this.timer);
      this.timer = null;
    },
    // 切走只停轮询。切回不重新请求，有待同步项时再按间隔继续。
    handleVisibilityChange() {
      if (document.hidden) this.clearTimer();
      else this.scheduleRefresh();
    },
    scheduleRefresh() {
      this.clearTimer();
      // 组件销毁后，或页面不可见时，不再安排下一轮轮询。
      // eslint-disable-next-line no-underscore-dangle
      if (this._isDestroyed || document.hidden || !this.syncTemplates.some(row => row.is_builtin === true
        && row.enabled === true && row.status === 'pending')) return;
      this.timer = setTimeout(() => this.refresh(true), 5000);
    },
    // 同时刷新模板列表和同步状态，有待同步时继续轮询。
    async refresh(silent = false) {
      this.clearTimer();
      if (document.hidden) return;
      if (!silent) this.loading = true;
      try {
        const [templates, statuses] = await Promise.all([
          this.$store.dispatch('tenantConfig/getAgentSandboxTemplates'),
          this.$store.dispatch('tenantConfig/getAgentSandboxTemplateSyncStatus'),
        ]);
        this.templates = templates;
        this.syncTemplates = statuses;
        this.scheduleRefresh();
      } catch (error) {
        this.catchErrorHandler(error);
      } finally {
        this.loading = false;
      }
    },
    changeLimit(limit) {
      this.limit = limit;
      this.page = 1;
    },
    // 停用单独用 disabled，其余只认可用、下发中和下发失败。
    statusClass(row) {
      if (row.enabled === false) return 'disabled';
      const status = this.syncStatusById[row.template_id]?.status;
      return ['succeeded', 'pending', 'failed'].includes(status) ? status : 'unknown';
    },
    // 停用优先展示；没有同步记录或状态未知时显示 --。
    statusLabel(row) {
      if (row.enabled === false) return this.$t('已停用');
      const sync = this.syncStatusById[row.template_id];
      if (!sync) return '--';
      if (sync.status === null) return this.$t('无可下发集群');
      const labels = { succeeded: this.$t('可用'), pending: this.$t('下发中'), failed: this.$t('下发失败') };
      return labels[sync.status] || '--';
    },
    resourceTooltip(row) {
      const disk = row.disk_size_mb === null ? this.$t('未挂载独立系统盘') : `${row.disk_size_mb} MB`;
      return `${this.$t('CPU')}: ${row.cpu_count} C / ${this.$t('内存')}: ${row.memory_mb} MB / ${this.$t('系统盘')}: ${disk}`;
    },
    // 请求未结束或侧栏正在编辑该行时，禁止再改开关、编辑和删除。
    isRowBusy(templateId) {
      return Boolean(this.busyRows[templateId] || this.editorTemplateId === templateId);
    },
    editorVisibilityChanged({ visible, templateId }) {
      this.editorTemplateId = visible ? templateId : '';
    },
    openEdit(row) {
      if (!this.isRowBusy(row.template_id)) this.$refs.editor.openEdit(row.template_id);
    },
    // 读取完整详情后更新开关，失败时拨回并恢复轮询。
    async changeSwitch(row, field, value) {
      if (this.isRowBusy(row.template_id)) return;
      const original = !value;
      const { template_id: templateId } = row;
      this.$set(this.busyRows, templateId, true);
      this.clearTimer();
      try {
        const detail = await this.$store.dispatch('tenantConfig/getAgentSandboxTemplateDetail', { templateId });
        // 提交全部可写字段，只替换当前开关；失败时拨回。
        const data = { ...getTemplatePayload(detail), [field]: value };
        await this.$store.dispatch('tenantConfig/updateAgentSandboxTemplate', { templateId, data });
        await this.refresh(true);
      } catch (error) {
        this.$set(row, field, original);
        this.catchErrorHandler(error);
      } finally {
        this.$delete(this.busyRows, templateId);
      }
    },
    // 确认后删除并刷新列表；取消或失败都解除该行锁定。
    confirmDelete(row) {
      if (this.isRowBusy(row.template_id)) return;
      const { template_id: templateId } = row;
      this.$set(this.busyRows, templateId, true);
      this.$bkInfo({
        title: this.$t('确认删除模板？'),
        subTitle: this.$t('删除模板 {name} 后将无法继续使用，有未销毁沙箱的模板不能删除。', {
          name: row.name || templateId,
        }),
        confirmLoading: true,
        confirmFn: async () => {
          try {
            await this.$store.dispatch('tenantConfig/deleteAgentSandboxTemplate', { templateId });
            await this.refresh(true);
            this.$paasMessage({ theme: 'success', message: this.$t('删除成功') });
            return true;
          } catch (error) {
            this.catchErrorHandler(error);
            return false;
          } finally {
            this.$delete(this.busyRows, templateId);
          }
        },
        cancelFn: () => this.$delete(this.busyRows, templateId),
      });
    },
  },
};
</script>

<style lang="scss" scoped>
.platform-sandbox-templates /deep/ .bk-table-pagination-wrapper {
  background: #fff;
}
.platform-sandbox-templates {
  /deep/ .bk-table-row,
  /deep/ .bk-table-row td {
    height: 56px;
  }
  /deep/ .bk-table-row td .cell {
    padding-top: 0;
    padding-bottom: 0;
  }
}
.column-help {
  border-bottom: 1px dashed #979ba5;
  cursor: help;
}
.templates-notice {
  margin-bottom: 16px;
}
.templates-toolbar,
.templates-tools {
  display: flex;
  align-items: center;
  gap: 12px;
}
.templates-toolbar {
  justify-content: space-between;
  margin-bottom: 16px;
}
.templates-search {
  width: 360px;
  max-width: 45vw;
}
.template-name,
.template-id {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 22px;
}
.template-name {
  color: #313238;
}
.template-id {
  color: #979ba5;
  font-size: 12px;
}
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
  &.succeeded .status-dot {
    background: #3fc06d;
    border-color: #daefe4;
  }
  &.pending .status-dot {
    background: #ff9c01;
    border-color: #ffefd6;
  }
  &.failed .status-dot {
    background: #ea3636;
    border-color: #fce0e0;
  }
}
.bk-button-text + .bk-button-text {
  margin-left: 8px;
}
</style>

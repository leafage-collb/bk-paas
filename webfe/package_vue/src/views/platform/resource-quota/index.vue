<template>
  <div class="resource-quota-container p-24">
    <bk-alert
      class="mb-16"
      type="info"
      :title="$t('资源方案添加后，应用将能够在“模块配置 - 进程配置”的资源配额方案中进行选择。')"
    ></bk-alert>
    <bk-button
      :theme="'primary'"
      icon="plus"
      @click="handleAddQuota"
    >
      {{ $t('添加方案') }}
    </bk-button>
    <bk-table
      ref="tableRef"
      :data="displayTemplateList"
      size="small"
      class="plan-table-cls mt-16"
      v-bkloading="{ isLoading: isTableLoading, zIndex: 10 }"
    >
      <bk-table-column
        v-for="column in columns"
        v-bind="column"
        :label="$t(column.label)"
        :key="column.prop"
        show-overflow-tooltip
      >
        <template slot-scope="{ row }">
          <span v-if="column.prop === 'is_active'">
            <span v-bk-tooltips="builtinTooltipConfig(row)">
              <bk-switcher
                v-model="row.is_active"
                theme="primary"
                :disabled="row.is_builtin || updatingActiveIds[row.id]"
                @change="(value) => handleActiveChange(value, row)"
              ></bk-switcher>
            </span>
          </span>
          <span v-else>{{ getCellValue(row, column.prop) || '--' }}</span>
        </template>
      </bk-table-column>
      <bk-table-column
        :label="$t('操作')"
        :width="200"
      >
        <template slot-scope="{ row }">
          <bk-button
            theme="primary"
            text
            class="mr10"
            @click="handleViewAffectedInstances(row)"
          >
            {{ $t('查看实例') }}
          </bk-button>
          <bk-button
            theme="primary"
            text
            class="mr10"
            @click="handleEdit(row)"
          >
            {{ $t('编辑') }}
          </bk-button>
          <span v-bk-tooltips="builtinTooltipConfig(row)">
            <bk-button
              theme="primary"
              text
              @click="handleDelete(row)"
              :disabled="row.is_builtin"
            >
              {{ $t('删除') }}
            </bk-button>
          </span>
        </template>
      </bk-table-column>
    </bk-table>

    <!-- 添加/编辑方案侧边栏 -->
    <QuotaPlanSideslider
      :visible.sync="showPlanSideslider"
      :edit-data="currentEditData"
      :cpu-options="cpuOptions"
      :memory-options="memoryOptions"
      @success="getResourceQuotaList"
    />

    <!-- 查看实例侧边栏 -->
    <AffectedInstancesSideslider
      :visible.sync="showAffectedInstancesSideslider"
      :quota-plan="currentQuotaPlan"
    />

    <!-- 无法删除方案 Dialog -->
    <bk-dialog
      v-model="showCannotDeleteDialog"
      :title="$t('无法删除方案')"
      :width="560"
      :mask-close="false"
      :show-footer="false"
      :close-icon="true"
      @closed="handleCannotDeleteDialogClosed"
    >
      <div class="cannot-delete-dialog-content">
        <p
          class="cannot-delete-desc"
          v-dompurify-html="deleteTips"
        ></p>
        <div class="cannot-delete-table-wrapper">
          <AffectedInstancesTable
            v-if="showCannotDeleteDialog"
            :quota-plan-id="cannotDeleteState.planId"
            :initial-instances="cannotDeleteState.instances"
            :initial-count="cannotDeleteState.totalCount"
            @count-change="handleCannotDeleteCountChange"
          />
        </div>
        <div class="cannot-delete-footer">
          <bk-button
            theme="default"
            @click="showCannotDeleteDialog = false"
          >
            {{ $t('关闭') }}
          </bk-button>
        </div>
      </div>
    </bk-dialog>
  </div>
</template>

<script>
import QuotaPlanSideslider from './quota-plan-sideslider.vue';
import AffectedInstancesSideslider from './affected-instances-sideslider.vue';
import AffectedInstancesTable from './affected-instances-table.vue';

const DEFAULT_PAGINATION = {
  current: 1,
  count: 0,
  // 删除拦截弹窗默认展示 5 条，预检查请求也保持同样的分页大小。
  limit: 5,
  limitList: [5, 10, 20, 50, 100],
};

const createPagination = (overrides = {}) => ({
  ...DEFAULT_PAGINATION,
  ...overrides,
});

const createCannotDeleteState = () => ({
  planId: null,
  planName: '',
  instances: [],
  totalCount: 0,
});

export default {
  name: 'ResourceQuota',
  components: {
    QuotaPlanSideslider,
    AffectedInstancesSideslider,
    AffectedInstancesTable,
  },
  data() {
    return {
      showPlanSideslider: false,
      showAffectedInstancesSideslider: false,
      currentEditData: null,
      currentQuotaPlan: {},
      displayTemplateList: [],
      isTableLoading: false,
      cpuOptions: [],
      memoryOptions: [],
      // 用于记录正在更新状态的方案 ID（使用对象实现响应式）
      updatingActiveIds: {},
      // 无法删除方案 Dialog 相关状态
      showCannotDeleteDialog: false,
      cannotDeleteState: createCannotDeleteState(),
    };
  },
  computed: {
    columns() {
      return [
        {
          label: '方案名称',
          prop: 'name',
        },
        {
          label: 'CPU(Limits)',
          prop: 'limits.cpu',
        },
        {
          label: `${this.$t('内存')}(Limits)`,
          prop: 'limits.memory',
        },
        {
          label: 'CPU(Requests)',
          prop: 'requests.cpu',
        },
        {
          label: `${this.$t('内存')}(Requests)`,
          prop: 'requests.memory',
        },
        {
          label: '是否启用',
          prop: 'is_active',
          'render-header': this.renderHeader,
        },
      ];
    },
    // 内置方案禁用操作的 tooltip 配置
    builtinTooltipConfig() {
      return (row) => ({
        content: row.is_builtin ? this.$t('平台内置方案不支持操作') : '',
        disabled: !row.is_builtin,
      });
    },
    deleteTips() {
      return this.$t('方案（{name}）正被以下 <i>{count}</i> 个应用、模块使用：', {
        name: this.cannotDeleteState.planName,
        count: this.cannotDeleteState.totalCount,
      });
    },
  },
  created() {
    this.init();
  },
  methods: {
    // 初始化页面数据
    async init() {
      await Promise.all([this.getResourceQuotaList(), this.fetchQuantityOptions()]);
    },
    // 获取资源配额选项
    async fetchQuantityOptions() {
      try {
        const res = await this.$store.dispatch('tenantOperations/fetchQuantityOptions');
        this.cpuOptions = res.cpu_resource_quantity || [];
        this.memoryOptions = res.memory_resource_quantity || [];
      } catch (e) {
        this.catchErrorHandler(e);
      }
    },
    renderHeader(h, data) {
      const directive = {
        name: 'bkTooltips',
        content: this.$t('停用后不影响已绑定的实例，但不能再绑定到新的应用'),
        placement: 'top',
      };
      return (
        <span
          class="custom-header-cell"
          v-bk-tooltips={directive}
        >
          {data.column.label}
        </span>
      );
    },
    // 获取单元格值(支持嵌套属性)
    getCellValue(row, prop) {
      if (!prop) return '';
      // 支持列配置中的嵌套属性，如 'limits.cpu'。
      return prop.split('.').reduce((value, key) => {
        if (value && typeof value === 'object') {
          return value[key];
        }
        return '';
      }, row);
    },
    // 获取资源方案列表
    async getResourceQuotaList() {
      this.isTableLoading = true;
      try {
        const res = await this.$store.dispatch('tenantConfig/getQuotaPlans');
        this.displayTemplateList = res || [];
      } catch (e) {
        this.catchErrorHandler(e);
      } finally {
        this.isTableLoading = false;
      }
    },
    // 添加资源方案
    handleAddQuota() {
      this.currentEditData = null;
      this.showPlanSideslider = true;
    },
    // 编辑资源方案
    handleEdit(row) {
      this.currentEditData = { ...row };
      this.showPlanSideslider = true;
    },
    // 查看资源方案影响的实例
    handleViewAffectedInstances(row) {
      this.currentQuotaPlan = { ...row };
      this.showAffectedInstancesSideslider = true;
    },
    buildQuotaPlanPayload(row, isActive) {
      return {
        name: row.name,
        limits: {
          cpu: row.limits.cpu,
          memory: row.limits.memory,
        },
        requests: {
          cpu: row.requests.cpu,
          memory: row.requests.memory,
        },
        is_active: isActive,
      };
    },
    fetchQuotaPlanUsedBy(planId, pagination = createPagination()) {
      const { current, limit } = pagination;
      return this.$store.dispatch('tenantConfig/getResQuotaPlanUsedBy', {
        id: planId,
        queryParams: {
          limit,
          offset: limit * (current - 1),
        },
      });
    },
    openCannotDeleteDialog(row, res) {
      const totalCount = res.count || 0;
      this.cannotDeleteState = {
        planId: row.id,
        planName: row.name,
        instances: res.results || [],
        totalCount,
      };
      this.showCannotDeleteDialog = true;
    },
    // 删除弹窗确认（先检查引用）
    async handleDelete(row) {
      try {
        // 删除前先查引用：有绑定实例时展示明细，避免用户删除后才收到后端错误。
        const res = await this.fetchQuotaPlanUsedBy(row.id);
        const totalCount = res.count || 0;
        if (totalCount > 0) {
          this.openCannotDeleteDialog(row, res);
        } else {
          // 无引用，保持原有删除确认流程
          this.showDeleteConfirm(row);
        }
      } catch (e) {
        this.catchErrorHandler(e);
      }
    },
    // 原有删除确认弹窗
    showDeleteConfirm(row) {
      const h = this.$createElement;
      this.$bkInfo({
        title: this.$t('是否删除该项目方案？'),
        extCls: 'paas-custom-del-info-cls',
        theme: 'danger',
        width: 480,
        okText: this.$t('删除'),
        subHeader: h('div', [
          h('p', [h('span', { class: ['label'] }, `${this.$t('方案名称')}：`), h('span', row.name)]),
          h('div', { class: ['tips'] }, this.$t('删除后，应用将不能再绑定该方案，请谨慎操作')),
        ]),
        confirmFn: async () => {
          await this.deleteQuotaPlan(row);
        },
      });
    },
    // 无法删除方案 Dialog 关闭时清空数据
    handleCannotDeleteDialogClosed() {
      this.cannotDeleteState = createCannotDeleteState();
    },
    handleCannotDeleteCountChange(count) {
      this.cannotDeleteState.totalCount = count;
    },
    // 删除资源方案
    async deleteQuotaPlan(row) {
      try {
        await this.$store.dispatch('tenantConfig/deleteQuotaPlan', { id: row.id });
        this.$paasMessage({
          theme: 'success',
          message: this.$t('删除成功'),
        });
        this.getResourceQuotaList();
      } catch (e) {
        if (e.code === 'CANNOT_DELETE_RES_QUOTA_PLAN') {
          const detailStr = JSON.stringify(e?.data?.used_by_processes || []);
          this.$bkMessage({
            theme: 'error',
            message: {
              code: e.status || e.code,
              overview: e.message || e.detail,
              suggestion: '',
              details: detailStr,
            },
            actions: [
              {
                id: 'assistant',
                disabled: true,
              },
            ],
            offsetY: 80,
            ellipsisLine: 2,
            ellipsisCopy: true,
          });
          return;
        }
        this.catchErrorHandler(e);
      }
    },
    // 处理启用/停用状态变更
    async handleActiveChange(value, row) {
      // 添加到更新中的对象，禁用开关
      this.$set(this.updatingActiveIds, row.id, true);
      try {
        // 后端更新方案需要完整资源配置，这里只变更启停状态并保留原有配额值。
        await this.$store.dispatch('tenantConfig/updateQuotaPlan', {
          id: row.id,
          data: this.buildQuotaPlanPayload(row, value),
        });

        this.$paasMessage({
          theme: 'success',
          message: value ? this.$t('启用成功') : this.$t('停用成功'),
        });
      } catch (e) {
        // 更新失败，回滚状态
        this.$set(row, 'is_active', !value);
        this.catchErrorHandler(e);
      } finally {
        // 从更新中的对象移除，恢复开关
        this.$delete(this.updatingActiveIds, row.id);
      }
    },
  },
};
</script>

<style lang="scss" scoped>
.resource-quota-container {
  /deep/ .bk-table-header .custom-header-cell {
    color: inherit;
    text-decoration: underline;
    text-decoration-style: dashed;
    text-underline-position: under;
  }
}
.cannot-delete-dialog-content {
  .cannot-delete-desc {
    margin-bottom: 16px;
    font-size: 14px;
    /deep/ i {
      font-style: normal;
      color: #ea3636;
    }
  }
  .cannot-delete-footer {
    margin-top: 24px;
    display: flex;
    justify-content: center;
  }
}
</style>

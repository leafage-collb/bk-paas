<template lang="html">
  <div
    :key="appCode"
    class="right-main"
  >
    <cloud-app-top-bar
      class="alarm-navigation"
      :title="$t('告警记录')"
      :nav-list="tabPanels"
      :active="activeTab"
      @change="handleTabChange"
    >
      <bk-button
        slot="right"
        text
        theme="primary"
        size="small"
        class="p0"
        @click="handleHelp"
      >
        {{ $t('文档：如何处理常见告警？') }}
      </bk-button>
    </cloud-app-top-bar>
    <paas-content-loader
      v-if="activeTab === 'application'"
      :is-loading="isLoading"
      placeholder="table-loading"
      :loader-props="{ operationCount: 1 }"
      :offset-top="10"
      class="app-container middle alarm-middle card-style"
    >
      <alarm-record @data-ready="handleDataReady" />
    </paas-content-loader>
    <gateway-alarm-record
      v-else
      :app-code="appCode"
      class="gateway-alarm-content"
    />
  </div>
</template>
<script>
import appBaseMixin from '@/mixins/app-base-mixin';
import cloudAppTopBar from '@/components/cloud-app-top-bar.vue';
import AlarmRecord from './alarm-record';
import GatewayAlarmRecord from './gateway-alarm-record.vue';

const APPLICATION_ALARM_QUERY_KEYS = ['record', 'start_after', 'start_before', 'env', 'search', 'genre'];

export default {
  // eslint-disable-next-line vue/multi-word-component-names
  name: '',
  components: {
    AlarmRecord,
    GatewayAlarmRecord,
    cloudAppTopBar,
  },
  mixins: [appBaseMixin],
  data() {
    return {
      isLoading: true,
      activeTab: 'application',
    };
  },
  computed: {
    tabPanels() {
      return [
        { name: 'application', label: this.$t('应用告警') },
        { name: 'gateway', label: this.$t('API 网关告警') },
      ];
    },
  },
  watch: {
    $route(to, from) {
      this.isLoading = true;
      if (to.params.id !== from.params.id) {
        this.activeTab = 'application';
      } else if (APPLICATION_ALARM_QUERY_KEYS.some(key => to.query[key] && to.query[key] !== from.query[key])) {
        this.activeTab = 'application';
      }
    },
  },
  methods: {
    handleTabChange(tab) {
      if (tab === this.activeTab) return;
      this.isLoading = true;
      this.activeTab = tab;
    },
    handleHelp() {
      window.open(this.GLOBAL.DOC.MONITOR_INTRO);
    },
    handleDataReady() {
      this.isLoading = false;
    },
  },
};
</script>
<style lang="scss" scoped>
.alarm-navigation {
  /deep/ .bk-tab-label-wrapper .bk-tab-label-list .bk-tab-label-item {
    min-width: 100px;
    padding: 0 18px;
  }
}

.alarm-middle {
  margin: 16px auto 30px;
  width: calc(100% - 48px);
  background: #fff;
  padding: 16px 24px;
}

.gateway-alarm-content {
  margin: 16px 24px 30px;
}
</style>

<template>
  <section
    class="home-record-tab-cls"
    v-if="panels.length"
    v-bkloading="{ isLoading: isLoading, zIndex: 10 }">
    <div class="tab-header">
      <div
        v-for="(panel, index) in showPanels"
        :key="index"
        :class="['tab-item', { active: panel.name === active }, { 'no-active': panels.length === 1 }]"
        @click="handleTabClick(panel)"
      >
        {{ panel.label }}
      </div>
    </div>
    <div class="tab-content">
      <!--应用闲置看板功能 -->
      <idle-app-dashboard v-show="active === 'idle'" @async-list-length="handlePanelUpdate" />
      <!-- 告警记录 -->
      <template v-if="platformFeature.MONITORING">
        <alarm-records v-show="active === 'alarm'" @async-list-length="handlePanelUpdate" />
      </template>
    </div>
  </section>
</template>

<script>
import idleAppDashboard from './idle-app-dashboard.vue';
import alarmRecords from './alarm-records.vue';
export default {
  name: 'HomeTab',
  components: {
    idleAppDashboard,
    alarmRecords,
  },
  data() {
    return {
      active: 'idle',
      isLoading: false,
      panels: [
        { name: 'idle', label: this.$t('闲置应用') },
        { name: 'alarm', label: this.$t('告警记录') },
      ],
    };
  },
  computed: {
    platformFeature() {
      return this.$store.state.platformFeature;
    },
    showPanels() {
      if (this.platformFeature.MONITORING) {
        return this.panels;
      }
      return this.panels.filter(item => item.name !== 'alarm');
    },
  },
  methods: {
    handleTabClick(data) {
      this.active = data.name;
    },
    handlePanelUpdate(data) {
      const { name, length } = data;
      this.isLoading = true;
      if (length === 0) {
        // 移除对应的 tab 项
        this.panels = this.panels.filter(panel => panel.name !== name);
        this.active = this.panels[0].name;
      } else {
        // 确保在 length > 0 时，该 tab 存在于 panels 中
        if (!this.panels.some(panel => panel.name === name)) {
          this.isLoading = true;
          if (name === 'idle') {
            this.panels.unshift({ name: 'idle', label: this.$t('闲置应用') });
          } else if (name === 'alarm') {
            this.panels.push({ name: 'alarm', label: this.$t('告警记录') });
          }
        }
      }
      setTimeout(() => {
        this.isLoading = false;
      }, 500);
    },
  },
};
</script>

<style lang="scss" scoped>
.home-record-tab-cls {
  margin-top: 24px;
}
.home-record-tab-cls {
  .tab-header {
    display: flex;
    align-items: center;
  }
  .tab-content {
    margin-top: 12px;
  }
  .tab-item {
    position: relative;
    height: 42px;
    padding: 0 4px;
    line-height: 42px;
    font-weight: 700;
    font-size: 16px;
    color: #313238;
    cursor: pointer;
    &.active {
      &::after {
        content: '';
        position: absolute;
        left: 0;
        bottom: 0;
        width: 100%;
        height: 2px;
        padding: 0 4px;
        background: #3A84FF;
      }
    }
    &.no-active {
      cursor: unset;
      &::after {
        content: '';
        background: transparent;
      }
    }
    &:first-child {
      margin-right: 40px;
    }
  }
}
/** 组件样式 */
.home-record-tab-cls {
  /deep/ .bk-tab-header {
    height: unset !important;
    background-image: none !important;
    .bk-tab-label-wrapper {
      width: 100%;
      // transform: translateX(-12px);
    }
  }
  /deep/ .bk-tab-label-wrapper .bk-tab-label-list {
    height: 42px !important;
    .bk-tab-label-item {
      line-height: 42px !important;
    }
    .bk-tab-label-item.active {
      color: #313238;
      font-weight: 700;
    }
  }
  /deep/ .bk-tab-section {
    padding: 0;
    padding-top: 12px;
  }
}
</style>

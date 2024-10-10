<template>
  <div>
    <section class="home-top-title">
      <div class="title">
        {{ $t('应用总览') }}
        <span class="tips">{{ $t('更新于 {t}之前', { t: appChartInfo.updateTime }) }}</span>
      </div>
      <div class="tools">
        <bk-select
          v-model="curDate"
          style="width: 137px;"
          :clearable="false"
          ext-cls="date-select-cls"
          @change="handleDateChange">
          <bk-option
            v-for="option in dateList"
            :key="option.id"
            :id="option.id"
            :name="option.label">
          </bk-option>
        </bk-select>
        <bk-button :theme="'primary'" @click="toCreateApp">
          {{ $t('创建应用') }}
        </bk-button>
      </div>
    </section>
    <div class="app-overview-container">
      <!-- 告警情况 -->
      <div class="alert-status card-style" v-if="platformFeature.MONITORING">
        <div class="card-title chart-title">
          {{ $t('告警情况') }}
          <!-- <i class="paasng-icon paasng-info-line"></i> -->
        </div>
        <div
          class="chart-el"
          v-charts="alertChartData"
        ></div>
      </div>
      <!-- 应用情况 -->
      <div class="app-status card-style">
        <div class="card-title chart-title">
          {{ $t('应用情况') }}
          <!-- <i class="paasng-icon paasng-info-line"></i> -->
        </div>
        <div
          class="chart-el"
          v-charts="appChartData"
        ></div>
      </div>
      <!-- 运维开发分 -->
      <!-- <div class="ops-dev-score card-style">
        <p class="card-title">运维开发分</p>
        <div class="info">
          <div>
            <span class="fraction">90</span>
            <span class="ml5">分</span>
          </div>
        </div>
      </div> -->
    </div>
  </div>
</template>

<script>
import alertChartOption from '@/json/home-page-chart-option';
import { formatDate } from '@/common/tools';
import { bus } from '@/common/bus';

export default {
  name: 'HomeAppOverview',
  data() {
    return {
      chartAppInfo: {
        total: 0,
        issueCount: 0,
      },
      curDate: 1,
      dateList: [
        { label: this.$t('1 天'), id: 1 },
        { label: this.$t('7 天'), id: 7 },
        { label: this.$t('15 天'), id: 15 },
        { label: this.$t('一个月'), id: 30 },
      ],
      curSelectionTime: this.getSpecifiedDate(1),
    };
  },
  computed: {
    appChartInfo() {
      return this.$store.state.baseInfo.appChartData;
    },
    alarmChartData() {
      return this.$store.state.baseInfo.alarmChartData;
    },
    // 告警情况图表数据
    alertChartData() {
      const data = [
        { value: this.alarmChartData.slowQueryCount, name: this.$t('慢查询告警数') },
        { value: this.alarmChartData.count, name: this.$t('总告警数') },
      ];
      const colors = ['#F5876C', '#FFC685'];
      return alertChartOption(data, colors);
    },
    // 应用情况图表数据
    appChartData() {
      const data = [
        { value: this.appChartInfo.idleAppCount, name: this.$t('闲置应用数') },
        { value: this.chartAppInfo.issueCount, name: this.$t('配置不当应用数') },
        { value: this.chartAppInfo.total, name: this.$t('总应用数') },
      ];
      const colors = ['#85CCA8', '#FFA66B', '#3E96C2'];
      return alertChartOption(data, colors);
    },
    platformFeature() {
      return this.$store.state.platformFeature;
    },
  },
  created() {
    this.getAppsInfoCount();
  },
  methods: {
    // 获取总应用数及issue_type应用数
    async getAppsInfoCount() {
      try {
        const res = await this.$store.dispatch('baseInfo/getAppsInfoCount');
        this.chartAppInfo = res;
        this.chartAppInfo.issueCount = res.issue_type_counts.length || 0;
      } catch (e) {
        this.catchErrorHandler(e);
      }
    },
    toCreateApp() {
      this.$router.push({ name: 'createApp' });
    },
    // daysToSubtract 距离当前日期的指定天数
    getSpecifiedDate(daysToSubtract, currentDate = new Date()) {
      // 确保传入的一个 Date 对象
      if (!(currentDate instanceof Date)) {
        throw new Error('currentDate must be a Date object');
      }

      const resultDate = new Date(currentDate);
      // 减去指定的天数
      resultDate.setDate(resultDate.getDate() - daysToSubtract);
      return {
        start: formatDate(resultDate),
        end: formatDate(currentDate),
      };
    },
    handleDateChange(day) {
      // 通知首页需要时间接口数据更新
      this.curSelectionTime = this.getSpecifiedDate(day);
      bus.$emit('home-date', this.curSelectionTime);
    },
  },
};
</script>

<style lang="scss" scoped>
.home-top-title {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 12px;
  .title {
    font-weight: 700;
    font-size: 16px;
    color: #313238;
    .tips {
      font-size: 12px;
      font-weight: 400;
      color: #979ba5;
    }
  }
  .tools {
    display: flex;
    .date-select-cls {
      background: #fff;
      margin-right: 12px;
    }
  }
}
.app-overview-container {
  display: flex;
  .mr16 {
    margin-right: 16px;
  }
  .card-style {
    margin-right: 16px;
    &:last-child {
      margin-right: 0;
    }
  }
  .alert-status,
  .app-status {
    position: relative;
    flex: 1;
    height: 200px;
    background: #fff;
    .chart-title {
      position: absolute;
      top: 12px;
      left: 24px;
    }
    .chart-el {
      height: 100%;
      width: 100%;
    }
  }
  .ops-dev-score {
    display: flex;
    flex-direction: column;
    width: 200px;
    height: 200px;
    padding: 12px 24px;
    background: #fff;
    .fraction {
      font-weight: 700;
      font-size: 48px;
      color: #313238;
    }
    .info {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
    }
  }
  .card-title {
    font-weight: 700;
    font-size: 14px;
    color: #63656e;
    i {
      font-size: 14px;
      color: #dcdee5;
    }
  }
}
</style>

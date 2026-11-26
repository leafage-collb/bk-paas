<template lang="html">
  <div class="platform-content">
    <div class="left-navigation">
      <paasNav
        :nav-categories="navCategories"
        :nav-items="navItems"
        :groups="groups"
      />
    </div>
    <div class="right-content">
      <TopBar
        ref="topBar"
        :title="title"
        :tab-panels="panels"
        @tab-change="handleTabChange"
      >
        <template
          v-if="isSubTitle"
          slot="extra"
        >
          <span class="sub-title">
            <span class="line"></span>
            <span>{{ $route.meta.subTitle }}：{{ $route.query?.id }}</span>
          </span>
        </template>
        <template
          slot="right"
          v-if="$route.meta.showRightSlot"
        >
          <router-link
            :to="{ name: $route.meta.showRightSlot?.routeName }"
            class="f14"
          >
            {{ $route.meta.showRightSlot?.title }}
          </router-link>
        </template>
      </TopBar>
      <div class="content-area">
        <router-view
          :tab-active="active"
          :key="routeIndex"
        />
      </div>
    </div>
  </div>
</template>

<script>
import { isNavigationFailure } from 'vue-router';
import paasNav from '@/components/paasNav';
import { processNavData } from '@/common/utils';
import { bus } from '@/common/bus';
import platformNavigationData from '@/json/platform-navigation-data';
import TopBar from './comps/top-bar.vue';

export default {
  components: {
    TopBar,
    paasNav,
  },
  data() {
    return {
      navCategories: [],
      navItems: [],
      groups: [
        { platform: this.$t('服务接入') },
        { operations: this.$t('运营管理') },
        { config: this.$t('配置管理') },
        { user: this.$t('用户管理') },
      ],
      active: '',
      routeIndex: 0,
    };
  },
  computed: {
    title() {
      const { name, path, params } = this.$route;
      if (name === 'clusterCreateEdit') {
        return path.endsWith('/add') ? this.$t('添加集群') : this.$t('编辑集群');
      }
      if (name === 'platformAppDetails') {
        return `${this.$t('应用详情')}: ${params.code}`;
      }
      return this.$route.meta.title;
    },
    isSubTitle() {
      const { name, path, meta } = this.$route;
      return meta?.subTitle && name === 'clusterCreateEdit' && path.endsWith('/edit');
    },
    panels() {
      return this.$route.meta?.panels || [];
    },
    routeTabActive() {
      return this.$route.query.active;
    },
  },
  watch: {
    $route() {
      this.routeIndex += 1;
    },
    panels(newValue) {
      if (newValue?.length) {
        this.setDefaultTabActive();
      }
    },
  },
  created() {
    bus.$on('tool-table-change', (active) => {
      this.handleTabChange(active);
    });
    this.setDefaultTabActive();
    // 组件销毁前
    this.$once('hook:beforeDestroy', () => {
      bus.$off('tool-table-change');
    });
  },
  mounted() {
    const { navCategories = [], navItems = [] } = processNavData(platformNavigationData);
    this.navCategories = navCategories;
    this.navItems = navItems;
  },
  methods: {
    // 用路由中的 active 选中页签，没有则用第一个，并写回路由。
    setDefaultTabActive() {
      const defaultActive = this.panels[0]?.name || '';
      this.active = this.routeTabActive || defaultActive;
      this.handleTabChange(this.active);
    },
    // 把页签写入 query；未保存确认取消导航时，恢复为当前路由对应的页签。
    async handleTabChange(active) {
      const { path, query, name } = this.$route;
      let newQuery = {};
      // 集群配置特殊处理
      if (name === 'platformAppCluster') {
        newQuery = {
          ...(active === 'list' && query),
          ...(active && { active }),
        };
      } else {
        newQuery = {
          ...query,
          ...(active && { active }),
        };
      }
      try {
        await this.$router.push({ path, query: newQuery });
      } catch (error) {
        // 侧栏未保存时可以取消导航，同时恢复 Tab，避免标题与页面内容不一致。
        if (!isNavigationFailure(error)) throw error;
      } finally {
        this.active = this.routeTabActive || this.panels[0]?.name || '';
        if (this.$refs.topBar) this.$refs.topBar.active = this.active;
      }
    },
  },
};
</script>

<style lang="scss" scoped>
.platform-content {
  display: flex;
  height: calc(100vh - var(--app-content-pd));
  .left-navigation {
    flex-shrink: 0;
    width: 240px;
    background: #fff;
    border-right: 1px solid rgb(220, 222, 229);
    height: 100%;
    z-index: 999;
  }
  .right-content {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
    height: 100%;
    background: #f5f7fa;
    .content-area {
      flex: 1;
      min-height: 0;
      overflow: auto;
    }
    .sub-title {
      display: flex;
      align-items: center;
      font-size: 14px;
      color: #979ba5;
      .line {
        display: inline-block;
        width: 1px;
        height: 14px;
        background-color: #dcdee5;
        margin: 0 8px;
      }
    }
  }
}
</style>
<style lang="scss">
.pt-json-editor-custom-cls {
  .jse-main .jse-message.jse-error {
    display: none;
  }
  // 隐藏模式切换
  .jse-menu {
    button.jse-group-button,
    .jse-separator {
      display: none;
    }
  }
}
.platform-content {
  .border-tag,
  .tag {
    display: inline-block;
    height: 22px;
    line-height: 22px;
    font-size: 12px;
    color: #4d4f56;
    padding: 0 8px;
    border-radius: 2px;
  }
  .tag {
    background: #f0f1f5;
    &.yes {
      background: #daf6e5;
      color: #299e56;
    }
  }
  .border-tag {
    background: #fafbfd;
    border: 1px solid #dcdee5;
  }
}
.paas-vue-json-pretty-cls {
  .vjs-key {
    color: #9d694c;
  }
  .vjs-value-number {
    color: #098658;
  }
  .vjs-value-string {
    color: #1f6d89;
  }
}
</style>

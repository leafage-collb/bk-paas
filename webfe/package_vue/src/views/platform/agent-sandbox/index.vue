<template>
  <div class="platform-agent-sandbox">
    <sandbox-overview v-if="activeTab === 'overview'" />
    <sandbox-templates v-else ref="templates" />
  </div>
</template>

<script>
import SandboxOverview from './overview.vue';
import SandboxTemplates from './templates.vue';

export default {
  name: 'PlatformAgentSandbox',
  components: { SandboxOverview, SandboxTemplates },
  props: {
    tabActive: { type: String, default: 'overview' },
  },
  computed: {
    // 页面以 query.active 为准，不使用外壳传入的 tabActive。
    activeTab() {
      return this.$route.query.active === 'templates' ? 'templates' : 'overview';
    },
  },
  beforeRouteEnter(to, from, next) {
    // 缺少或非法的 active 统一改回概览，避免 Tab 与页面不一致。
    if (!['overview', 'templates'].includes(to.query.active)) {
      next({ ...to, replace: true, query: { ...to.query, active: 'overview' } });
      return;
    }
    next();
  },
  async beforeRouteUpdate(to, from, next) {
    if (!await this.canLeave()) return next(false);
    if (!['overview', 'templates'].includes(to.query.active)) {
      return next({ ...to, replace: true, query: { ...to.query, active: 'overview' } });
    }
    next();
  },
  async beforeRouteLeave(to, from, next) {
    next(await this.canLeave());
  },
  methods: {
    // 只有模板页挂着编辑侧栏；概览页没有未保存草稿。
    async canLeave() {
      return this.$refs.templates ? this.$refs.templates.beforeLeave() : true;
    },
  },
};
</script>

<style lang="scss" scoped>
.platform-agent-sandbox {
  min-width: 0;
  padding: 24px;
}
</style>

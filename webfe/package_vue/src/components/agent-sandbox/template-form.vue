<template>
  <bk-form ref="form" :model="formData" :rules="rules" form-type="vertical" class="sandbox-template-form">
    <bk-collapse v-model="expandedGroups" class="template-sections">
      <bk-collapse-item
        v-for="group in fieldGroups"
        :key="group.key"
        :name="group.key"
        :hide-arrow="true"
        content-hidden-type="hidden"
        class="form-section"
      >
        <span class="section-title">
          <i
            class="paasng-icon"
            :class="expandedGroups.includes(group.key) ? 'paasng-down-shape' : 'paasng-right-shape'"
          />
          {{ group.label }}
        </span>
        <div slot="content" class="section-fields">
          <bk-form-item
            v-for="field in group.fields"
            :key="field.key"
            :label="field.label"
            :property="field.key"
            :required="field.required"
            error-display-type="normal"
          >
            <bk-input
              v-model="formData[field.key]"
              :type="field.key === 'description' ? 'textarea' : 'text'"
              :maxlength="field.maxlength"
              :rows="3"
              :disabled="disabled || (isEdit && field.key === 'template_id')"
              :placeholder="field.placeholder"
              @change="clearFieldError(field.key)"
            />
            <p v-if="field.hint" class="field-hint">{{ field.hint }}</p>
            <p v-if="fieldErrors[field.key]" class="field-error">{{ fieldErrors[field.key] }}</p>
          </bk-form-item>
          <!-- 平台的启用、可见由调用方插入，应用模式没有这段 -->
          <slot v-if="group.key === 'basic'" name="basic-extra" />
          <template v-if="group.key === 'image'">
            <bk-form-item :label="$t('环境变量')">
              <key-value-editor
                v-model="formData.env_rows"
                property-prefix="env_rows"
                :key-rules="envKeyRules"
                :disabled="disabled"
                @change="clearFieldError('env_vars')"
              />
              <p v-if="fieldErrors.env_vars" class="field-error">{{ fieldErrors.env_vars }}</p>
            </bk-form-item>
            <bk-form-item :label="$t('工作目录')" property="workdir" error-display-type="normal">
              <bk-input
                v-model="formData.workdir"
                :disabled="disabled"
                :maxlength="256"
                placeholder="/home/user"
                @change="clearFieldError('workdir')"
              />
              <p v-if="fieldErrors.workdir" class="field-error">{{ fieldErrors.workdir }}</p>
            </bk-form-item>
          </template>
        </div>
      </bk-collapse-item>
      <bk-collapse-item name="resources" :hide-arrow="true" content-hidden-type="hidden" class="form-section">
        <span class="section-title">
          <i
            class="paasng-icon"
            :class="expandedGroups.includes('resources') ? 'paasng-down-shape' : 'paasng-right-shape'"
          />
          {{ $t('资源') }}
        </span>
        <div slot="content" class="section-fields">
          <div class="resource-fields">
            <bk-form-item :label="$t('CPU')" property="cpu_count" error-display-type="normal">
              <bk-select
                v-model="formData.cpu_count"
                :disabled="disabled"
                :clearable="false"
                @change="clearFieldError('cpu_count')"
              >
                <bk-option v-for="cpu in cpuOptions" :key="cpu" :id="cpu" :name="$t('{count} 核', { count: cpu })" />
              </bk-select>
              <p v-if="fieldErrors.cpu_count" class="field-error">{{ fieldErrors.cpu_count }}</p>
            </bk-form-item>
            <bk-form-item :label="$t('内存')" property="memory_gb" error-display-type="normal">
              <bk-select
                v-model="formData.memory_gb"
                :disabled="disabled"
                :clearable="false"
                @change="clearFieldError('memory_mb')"
              >
                <bk-option v-for="memory in memoryOptions" :key="memory" :id="memory" :name="`${memory} GB`" />
              </bk-select>
              <p v-if="fieldErrors.memory_mb" class="field-error">{{ fieldErrors.memory_mb }}</p>
            </bk-form-item>
          </div>
          <bk-form-item :label="$t('系统盘')" property="disk_size_mb" error-display-type="normal">
            <bk-checkbox v-model="formData.disk_enabled" :disabled="disabled" @change="clearFieldError('disk_size_mb')">
              {{ $t('挂载独立系统盘') }}
            </bk-checkbox>
            <bk-input
              v-if="formData.disk_enabled"
              v-model="formData.disk_size_mb"
              class="disk-size"
              type="number"
              :min="1024"
              :max="102400"
              :precision="0"
              :disabled="disabled"
              @change="clearFieldError('disk_size_mb')"
            >
              <div slot="append" class="group-text">MB</div>
            </bk-input>
            <p class="field-hint">{{ $t('不挂载时使用运行时默认的根文件系统；挂载时为每个沙箱创建一块云盘，随沙箱销毁而删除') }}</p>
            <p v-if="fieldErrors.disk_size_mb" class="field-error">{{ fieldErrors.disk_size_mb }}</p>
          </bk-form-item>
          <!-- 平台的每集群预热由调用方插入 -->
          <slot name="resource-extra" />
        </div>
      </bk-collapse-item>
    </bk-collapse>
  </bk-form>
</template>

<script>
import KeyValueEditor from '@/components/key-value-editor';

const CPU_OPTIONS = [1, 2, 4, 8];
const MEMORY_OPTIONS = [1, 2, 4, 8, 16];
const TEMPLATE_ID_PATTERN = /^[a-z][a-z0-9-]{0,29}[a-z0-9]$/;
const TEMPLATE_ID_MIN_LENGTH = 2;
const RESOURCE_NAME_MAX_LENGTH = 61;
const ENV_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

export default {
  name: 'SandboxTemplateForm',
  components: { KeyValueEditor },
  props: {
    templateData: { type: Object, default: () => ({}) },
    appCode: { type: String, default: '' },
    // 平台模式没有应用前缀，模板 ID 只校验自身 2–31 位。
    mode: {
      type: String,
      default: 'application',
      validator: value => ['application', 'platform'].includes(value),
    },
    isEdit: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    fieldErrors: { type: Object, default: () => ({}) },
  },
  data() {
    const template = this.templateData;
    const envRows = Object.entries(template.env_vars || {}).map(([key, value], id) => ({ id, key, value }));
    return {
      expandedGroups: ['basic', 'image', 'resources'],
      cpuOptions: CPU_OPTIONS,
      memoryOptions: MEMORY_OPTIONS,
      formData: {
        template_id: template.template_id || '',
        name: template.name || '',
        description: template.description || '',
        image: template.image || '',
        cpu_count: template.cpu_count ?? 2,
        memory_gb: (template.memory_mb ?? 4096) / 1024,
        disk_enabled: template.disk_size_mb !== null && template.disk_size_mb !== undefined,
        disk_size_mb: template.disk_size_mb ?? 20480,
        env_rows: envRows,
        workdir: template.workdir || '',
      },
    };
  },
  computed: {
    maxTemplateIdLength() {
      if (this.mode === 'platform') return 31;
      const prefix = `${this.appCode.toLowerCase().replace(/_/g, '0us0')}--`;
      return RESOURCE_NAME_MAX_LENGTH - prefix.length;
    },
    fieldGroups() {
      const fields = [
        {
          key: 'template_id', label: this.$t('模板 ID'), required: true, maxlength: 31,
          placeholder: this.$t('例如 e2b-envd'),
          hint: this.mode === 'platform'
            ? this.$t('SDK 创建沙箱时传入的 templateID，须与底层 e2b 网关一致，创建后不可修改')
            : this.$t('SDK 创建沙箱时传入的 templateID，创建后不可修改。小写字母、数字、连接符，2-31 个字符，与应用 ID 合计不超过 61 个字符'),
        },
        { key: 'name', label: this.$t('名称'), required: true, maxlength: 64 },
        { key: 'description', label: this.$t('描述'), required: false, maxlength: 200 },
        {
          key: 'image', label: this.$t('镜像'), required: true, maxlength: 256,
          placeholder: 'mirrors.example.com/xxx/image:tag',
          hint: this.$t('镜像须内置 envd'),
        },
      ];
      return [
        { key: 'basic', label: this.$t('基本信息'), fields: fields.slice(0, 3) },
        { key: 'image', label: this.$t('镜像'), fields: fields.slice(3) },
      ];
    },
    rules() {
      const required = { required: true, message: this.$t('必填项'), trigger: 'blur' };
      const maxLength = length => ({
        validator: value => value.length <= length,
        message: this.$t('最多输入 {length} 个字符', { length }),
        trigger: 'blur',
      });
      return {
        template_id: [required, {
          validator: value => TEMPLATE_ID_PATTERN.test(value) && !value.includes('--'),
          message: this.$t('模板 ID 格式不正确'),
          trigger: 'blur',
        }, {
          validator: value => this.mode === 'platform' || this.isEdit
            || this.maxTemplateIdLength < TEMPLATE_ID_MIN_LENGTH
            || value.length <= this.maxTemplateIdLength,
          message: this.$t('应用标识与模板 ID 组合后的资源名不能超过 61 个字符'),
          trigger: 'blur',
        }],
        name: [required, maxLength(64), {
          validator: value => Boolean(value.trim()), message: this.$t('必填项'), trigger: 'blur',
        }],
        description: [maxLength(200)],
        image: [required, maxLength(256), {
          validator: value => Boolean(value.trim()), message: this.$t('必填项'), trigger: 'blur',
        }],
        cpu_count: [{
          validator: value => CPU_OPTIONS.includes(value), message: this.$t('请选择 CPU 规格'), trigger: 'change',
        }],
        memory_gb: [{
          validator: value => MEMORY_OPTIONS.includes(value), message: this.$t('请选择内存规格'), trigger: 'change',
        }],
        disk_size_mb: [{
          validator: value => !this.formData.disk_enabled
            || (Number.isInteger(Number(value)) && Number(value) >= 1024 && Number(value) <= 102400),
          message: this.$t('系统盘容量必须为 1024–102400 MB 的整数'),
          trigger: 'blur',
        }],
        workdir: [maxLength(256), {
          validator: value => !value || value.startsWith('/'),
          message: this.$t('工作目录必须以 / 开头'),
          trigger: 'blur',
        }],
      };
    },
    envKeyRules() {
      return [{
        validator: (value) => {
          if (!value) return !this.formData.env_rows.some(item => !item.key && item.value !== '');
          return ENV_KEY_PATTERN.test(value);
        },
        message: this.$t('变量名只能包含字母、数字和下划线，且不能以数字开头'),
        trigger: 'blur',
      }, {
        validator: value => !value || this.formData.env_rows.filter(item => item.key === value).length === 1,
        message: this.$t('环境变量名称不能重复'),
        trigger: 'blur',
      }];
    },
  },
  watch: {
    fieldErrors(errors) {
      if (Object.keys(errors).length) this.expandedGroups = ['basic', 'image', 'resources'];
    },
  },
  methods: {
    clearFieldError(field) {
      this.$emit('field-change', field);
    },
    getDraftState() {
      return this.formData;
    },
    // 校验表单并转换成提交字段；应用 ID 过长时直接拒绝创建。
    async validate() {
      if (this.mode === 'application' && !this.isEdit && this.maxTemplateIdLength < TEMPLATE_ID_MIN_LENGTH) {
        const error = new Error(this.$t('应用 ID 过长，无法创建自定义模板'));
        error.code = 'AGENT_SANDBOX_E2B_APP_CODE_TOO_LONG';
        error.detail = error.message;
        throw error;
      }
      try {
        await this.$refs.form.validate();
      } catch (error) {
        this.expandedGroups = ['basic', 'image', 'resources'];
        throw error;
      }
      const data = this.formData;
      // 完成唯一性校验后才转对象，空占位行不提交，变量值不做 trim。
      const envVars = Object.fromEntries(data.env_rows.filter(row => row.key).map(({ key, value }) => [key, value]));
      const params = {
        name: data.name.trim(),
        description: data.description,
        image: data.image.trim(),
        cpu_count: data.cpu_count,
        memory_mb: data.memory_gb * 1024,
        disk_size_mb: data.disk_enabled ? Number(data.disk_size_mb) : null,
        env_vars: envVars,
        workdir: data.workdir,
      };
      if (!this.isEdit) params.template_id = data.template_id;
      return params;
    },
  },
};
</script>

<style lang="scss" scoped>
.form-section {
  margin-bottom: 24px;
  &:last-child {
    margin-bottom: 0;
  }
  /deep/ .bk-collapse-item-header {
    height: 32px;
    padding: 0 16px;
    background: #f0f1f5;
    border-radius: 2px;
    line-height: 32px;
  }
  /deep/ .bk-collapse-item-content {
    padding: 0;
  }
}
.section-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #313238;
  font-size: 14px;
  font-weight: 700;
  line-height: 20px;
  .paasng-icon {
    color: #63656e;
    font-size: 12px;
  }
}
.section-fields {
  padding-top: 20px;
}
.sandbox-template-form.bk-form.bk-form-vertical {
  /deep/ .bk-label {
    height: 24px;
    min-height: 24px;
    line-height: 24px;
  }
  /deep/ .section-fields > .bk-form-item {
    margin-top: 24px;
    &:first-child {
      margin-top: 0;
    }
  }
  /deep/ .resource-fields > .bk-form-item {
    margin-top: 0;
  }
}
.field-hint,
.field-error {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 18px;
  overflow-wrap: anywhere;
}
.field-hint {
  color: #979ba5;
}
.field-error {
  color: #ea3636;
}
.resource-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}
.disk-size {
  width: calc((100% - 16px) / 2);
  margin-top: 12px;
  /deep/ .group-text {
    padding: 0 10px;
    background-color: #fafbfd;
  }
}
</style>

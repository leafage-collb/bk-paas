<template>
  <div class="key-value-editor">
    <div v-for="(row, index) in value" :key="row.id" class="kv-row">
      <!-- 键：通过 property 挂到父级 bk-form 上做校验，因此本组件需在 bk-form 内使用 -->
      <bk-form-item
        class="kv-field"
        :property="keyProperty(index)"
        :rules="propertyPrefix ? keyRules : []"
        error-display-type="normal"
      >
        <bk-input
          :value="row.key"
          :placeholder="$t('键')"
          :disabled="disabled"
          @input="value => updateCell(index, 'key', value)"
        />
      </bk-form-item>
      <span class="kv-equals">=</span>
      <div class="kv-field">
        <bk-input
          :value="row.value"
          :placeholder="$t('值')"
          :disabled="disabled"
          @input="value => updateCell(index, 'value', value)"
        />
      </div>
      <div
        class="kv-remove"
        :class="{ 'is-disabled': disabled }"
        :title="$t('删除')"
        @click="handleRemove(index)"
      >
        <i class="paasng-icon paasng-delete" />
      </div>
    </div>
    <bk-button
      text
      theme="primary"
      icon="plus-circle-shape"
      :disabled="disabled"
      @click="handleAdd"
    >
      {{ $t('添加') }}
    </bk-button>
  </div>
</template>

<script>
export default {
  name: 'KeyValueEditor',
  props: {
    value: { type: Array, default: () => [] },
    propertyPrefix: { type: String, default: '' },
    keyRules: { type: Array, default: () => [] },
    disabled: { type: Boolean, default: false },
  },
  data() {
    return {
      nextUid: 0,
    };
  },
  methods: {
    keyProperty(index) {
      return this.propertyPrefix ? `${this.propertyPrefix}.${index}.key` : '';
    },
    updateCell(index, field, val) {
      const rows = this.value.map((row, i) => (i === index ? { ...row, [field]: val } : row));
      this.$emit('input', rows);
      this.$emit('change', rows);
    },
    handleAdd() {
      if (this.disabled) return;
      this.nextUid += 1;
      const row = { id: `kv-row-${this.nextUid}`, key: '', value: '' };
      const rows = [...this.value, row];
      this.$emit('input', rows);
      this.$emit('change', rows);
    },
    handleRemove(index) {
      if (this.disabled) return;
      const rows = this.value.filter((row, i) => i !== index);
      this.$emit('input', rows);
      this.$emit('change', rows);
    },
  },
};
</script>

<style lang="scss" scoped>
.key-value-editor {
  .kv-row {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin-bottom: 12px;
  }
  .kv-field {
    flex: 1;
    min-width: 0;
    margin: 0;
    ::v-deep .bk-form-content {
      margin-left: 0 !important;
    }
  }
  .kv-equals,
  .kv-remove {
    flex-shrink: 0;
    line-height: 32px;
  }
  .kv-equals {
    color: #63656e;
  }
  .kv-remove {
    cursor: pointer;
    color: #979ba5;
    &:hover {
      color: #3a84ff;
    }
    &.is-disabled {
      cursor: not-allowed;
      color: #dcdee5;
    }
  }
}
</style>

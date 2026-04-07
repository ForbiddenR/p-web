<script setup>
defineProps({
  msg: {
    type: String,
    required: true,
  },
})
</script>

<template>
  <div class="hello">
    <h1>{{ msg }}</h1>
    <p>Vue + Vite scaffold is in place (with axios installed).</p>
  </div>
</template>

<style scoped>
.hello {
  padding: 2rem;
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
}

h1 {
  margin: 0 0 0.5rem;
  font-size: 1.5rem;
}

p {
  margin: 0;
  color: #666;
}
</style>


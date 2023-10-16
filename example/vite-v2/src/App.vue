<template>
 <div>
    <button @click="setLocale('ZH_CN')">中文</button>
    <button @click="setLocale('EN')">英文</button>
    <div><span>一二三 {{ name5 }} 一二三</span></div>
    <h6>文本测试</h6>
    <div><!--一二三--></div>
    一二三
    <div>一二三</div>
    <div><span><span><span><span><span>一二三</span></span></span></span></span></div>
    <div>{{"一二三"}}</div>
    <div><span>一二三 {{ 1 }} {{ true }}</span></div>
    <div><span>一二三 {{ name5 }} 一二三</span></div>
    <div><span :class="{ foo: true }">{{ name5 === "EN" ? "" : "一二三" }}</span></div>
    <h6>包含指令</h6>
    <div><div id="foo" v-foo>一二三</div></div>
    <div><div id="foo" v-foo title="一二三"></div></div>
    <div><div id="foo" v-foo title="一二三">"{{"一二三"}}"</div></div>
    <div><div id="foo" v-foo title="一二三">一二三</div></div>
    <h6>static props</h6>
    <div title="一二三" name="name5"></div>
    <h6>dynamic props</h6>
    <div title="一二三" :name="name5" :test="'一二三' + name5"></div>
    <div :[name5]="'一二三'" :name="name5" :test="'一二三' + name5"></div>
    <h6>props + children</h6>
    <div title="一二三" :name="name5">一二三</div>
    <h6>v-bind</h6>
    <div v-bind="$attrs" title="一二三" name="name5">一二三</div>
    <h6>v-bind after static prop</h6>
    <div title="一二三" name="name5" v-bind="$attrs">一二三</div>
    <h6>v-bind between static props</h6>
    <div name="name5" v-bind="$attrs" title="一二三" class="test" :class="name5">一二三</div>
    <template title="一二三" />
    <h6>for 循环</h6>
    <div><div v-for="i in list" :key="i" id="foo"><span>一二三</span></div></div>
    <div><div v-for="i in list" :key="i" id="foo"><span>{{"一二三"}}</span></div></div>
    <h6>if 判断</h6>
    <div><div v-if="name5 === 'EN'">一二三</div><p v-else>{{"一二三"}}</p></div>
    <h6>文本插值</h6>
    <div><span>{{"一二三"}}</span></div>
    <div><span>一二三 {{ 1 }} {{ true }}</span></div>
    <div><span>一二三 {{ name5 }} 一二三</span></div>
    <div><span :class="{ foo: true }">{{ name5 === "EN" ? "" : "一二三" }}</span></div>
    <h6>包含事件</h6>
    <div><div @click="foo">一二三</div></div>
    <div><div :class="{}" title="一二三" @click="foo">一二三</div></div>
    <h6>组件</h6>
    <div><Comp content="一二三"/></div>
    <div><Comp content="一二三" :name="name5" /></div>
    <div><Comp>一二三</Comp></div>
    <div><Comp :name="name5"><div><span><span><span><span><span>一二三</span></span></span></span></span></div></Comp></div>
    <div><Comp :name="name"><template #default="{name}">一二三{{name}}</template></Comp></div>
    <h6>svg</h6>
    <div><svg title="一二三" style="font-size:12px;width:1em;height:1em"><path d="M2,3H5.5L12"/></svg></div>
    <div>"静态节点"</div>
    <h6>StaticVNode</h6>
    <div>静态节点</div>
    <div title="一二三">一二三</div>
    <div>静态节点</div>
    <div>一二三</div>
    <div>
      <div>静态节点</div>
      <div>一二三</div>
      <div>静态节点</div>
      <div>"一二三"</div>
      <div>"一二三"</div>
    </div>
 </div>
</template>

<style scoped>
h6 {
  font-size: 18px;
  margin: 10px 0;
}
</style>

<script>
export default {
  components: {},
  props: {},
  directives: {
    foo() {},
  },
  data() {
    return {
      name5: "x",
      name: 'bw',
      list: [1, 2, 3]
    };
  },
  components: {
    Comp: {
      functional: true,
      render(h, context){
        const { props, scopedSlots } = context
        return scopedSlots.default ? scopedSlots.default(props) : (props.content || "无内容")
      }
    }
  },
  methods: {
    foo() {
      this.name += `一二三${this.name}`
    },
    setLocale(code){
      this.$root.$i18n.locale = code;
    }
  },
};
</script>

import View from './view';
import Vue from 'vue';
import Vuex from 'vuex';
import store from '../vuex/store';
import * as editUtil from '../utils/edit';
import * as httpUtil from '../utils/http';
import * as toolbarUtil from '../utils/toolbar';
import * as _ from 'lodash';
import * as VocabLoader from '../utils/vocabloader';
import * as VocabUtil from '../utils/vocab';
import * as RecordUtil from '../utils/record';
import * as UserUtil from '../utils/user';
import FormComponent from '../components/formcomponent';
import EditorControls from '../components/editorcontrols';
import { getSettings, getVocabulary, getEditorData } from '../vuex/getters';
import { changeSettings, loadVocab, syncData } from '../vuex/actions';

export default class Editor extends View {

  initialize() {
    super.initialize();
    VocabLoader.initVocabClicks();
    toolbarUtil.initToolbar(this);
    this.dataIn = this.loadItem(JSON.parse(document.getElementById('data').innerText)['@graph']);
    const self = this;

    self.settings = {
      lang: 'sv',
      vocabPfx: 'kbv:',
    };

    VocabUtil.getVocab().then((vocab) => {
      self.vocab = vocab;
      self.initVue();
    });
  }

  populateHolding(meta, thing) {
    const emptyHolding = JSON.stringify(RecordUtil.getEmptyHolding(thing['@id'], UserUtil.get('sigel')));
    $('#holdingItem').text(emptyHolding);
  }

  loadItem(data) {
    let dataObj = {};
    // Retrieves the data and splits it into a thing obj and array with links
    this.originalData = data;

    // TODO: Relying on order here... tsk tsk tsk.
    dataObj.meta = this.originalData[0];
    this.originalData.splice(0, 1);

    // TODO: Do something else!
    console.warn('Finding focused item node by @id.indexOf("#it"). This approach is not reliable.');
    for (let i = 0; i < this.originalData.length; i++) {
      if (this.originalData[i]['@id'] && this.originalData[i]['@id'].indexOf('#it') !== -1) {
        dataObj.thing = this.originalData[i];
        this.originalData.splice(i, 1);
        break;
      }
    }
    if(!dataObj.thing && this.originalData.length >= 0) {
      dataObj.thing = this.originalData[0];
      this.originalData.splice(0, 1);
    }

    dataObj.linked = [];
    for (let i = 0; i < this.originalData.length; i++) {
      if (this.originalData[i].hasOwnProperty('@graph')) {
        dataObj.linked.push(this.originalData[i]['@graph']);
      } else {
        dataObj.linked.push(this.originalData[i]);
      }
    }

    // HOLDING FORM
    // this.populateHolding(this.meta, this.thing);

    return dataObj;
  }

  initVue() {
    const self = this;
    $('#loadingText').fadeOut('slow', function() {
      $('#editorApp').fadeIn('slow');
    });

    document.getElementById('body-blocker').addEventListener('click', function () {
      self.vm.$broadcast('close-modals');
    }, false);

    Vue.filter('labelByLang', (label) => {
      const pfx = self.settings.vocabPfx;
      const lang = self.settings.lang;
      // Filter for fetching labels from vocab
      let lbl = label;
      if (lbl && lbl.indexOf(pfx) !== -1) {
        lbl = lbl.replace(pfx, '');
      }
      const item = _.find(self.vocab.descriptions, (d) => { return d['@id'] === `${pfx}${lbl}`; });
      let labelByLang = '';
      if (typeof item !== 'undefined' && item.labelByLang) {
        labelByLang = item.labelByLang[lang];
      }
      // Check if we have something of value
      if (labelByLang.length > 0) {
        return labelByLang;
      }
      return lbl;
    });

    Vue.use(Vuex);

    self.vm = new Vue({
      el: '#editorApp',
      vuex: {
        actions: {
          syncData,
          loadVocab,
          changeSettings,
        },
        getters: {
          settings: getSettings,
          editorData: getEditorData,
          vocab: getVocabulary,
        },
      },
      data: {
        initialized: false,
        status: {
          dirty: true,
          saved: {
            loading: false,
            status: {
              error: false,
              info: '',
            },
          },
        },
        showJSON: false,
      },
      events: {
        'focus-update': function(value, oldValue) {
          const newData = this.editorData;
          console.log("Update");
          if (oldValue === this.editorData.meta) {
            newData.meta = value;
            // this.$set('meta', value);
          } else if (oldValue === this.editorData.thing) {
            newData.thing = value;
            // this.$set('thing', value);
          } else {
            console.warn('Something went wrong trying to update a focused object.');
          }
          this.syncData(newData);
        },
        'save-item': function() {
          this.status.saved.loading = true;
          this.saveItem();
        },
        'check-changes': function() {
          const inputData = JSON.parse(document.getElementById('data').innerText);
          const obj = editUtil.getMergedItems(
            editUtil.removeNullValues(this.editorData.meta),
            editUtil.removeNullValues(this.editorData.thing),
            this.editorData.linked
          );
          if (JSON.stringify(obj) === JSON.stringify(inputData)) {
            this.status.dirty = false;
          } else {
            this.status.dirty = true;
          }
        },
        'show-message': function(messageObj) {
          console.log("Should show notification", JSON.stringify(messageObj));
        },
      },
      watch: {
        copyId(value, oldval) {
          if (value.length === 0 && oldval && oldval.length > 0) {
            this.copy.state = '';
          } else if (!/[^a-z0-9]/gi.test(value)) {
            this.getCopyItem(value);
          } else {
            this.copy.state = 'invalid';
          }
        },
      },
      methods: {
        isArray(o) {
          return _.isArray(o);
        },
        isPlainObject(o) {
          return _.isPlainObject(o);
        },
        convertItemToMarc() {
          return httpUtil.post({
            url: '/_convert',
            token: self.access_token
          },
            // Use clean method on args
            editUtil.getMergedItems(this.editorData.meta, this.editorData.thing, this.editorData.linked)
          );
        },
        saveItem() {
          const inputData = JSON.parse(document.getElementById('data').innerText);
          const obj = editUtil.getMergedItems(
            editUtil.removeNullValues(this.editorData.meta),
            editUtil.removeNullValues(this.editorData.thing),
            this.editorData.linked
          );

          // if (JSON.stringify(obj) === JSON.stringify(inputData)) {
          //   console.warn("No changes done, skipping to save. Time to tell the user?");
          // } else {
            const atId = this.editorData.meta['@id'];
            console.log(atId);
            if(atId) {
              console.log("Save called WITH changes.");
              this.doSave(atId, obj);
            } else {
              console.log("Create called WITH changes.");
              this.doCreate(obj);
            }
          // }
        },
        doSave(url, obj) {
          this.doRequest(httpUtil.put, obj, url);
        },
        doCreate(obj) {
          this.doRequest(httpUtil.post, obj, '/create');
        },
        doRequest(requestMethod, obj, url) {
          this.status.saved.loading = true;
          requestMethod({ url, token: self.access_token }, obj).then((result) => {
            console.log('Success was had');
            self.vm.syncData(self.loadItem(result['@graph']));
            self.vm.status.saved.loading = false;
            self.vm.status.saved.status = { error: false, info: '' };
            this.$dispatch('show-message', {
              title: 'OK!',
              msg: 'Posten blev sparad...',
              type: 'success',
            });
          }, (error) => {
            self.vm.status.saved.loading = false;
            self.vm.status.saved.status = { error: true, info: error };
            this.$dispatch('show-message', {
              title: 'Något gick fel!',
              msg: error,
              type: 'error',
            });
          });
        },
      },
      ready() {
        this.changeSettings(self.settings);
        this.loadVocab(self.vocab);
        this.syncData(self.dataIn);
        this.initialized = true;
      },
      components: {
        'form-component': FormComponent,
        'editor-controls': EditorControls,
      },
      store,
    });
  }
}

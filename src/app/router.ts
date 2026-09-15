/** 路由与守卫（docs/03_页面与组件规格.md v1.1 §3）。 */
import { createRouter, createWebHashHistory } from 'vue-router';
import { pageAvailable } from '../game/selectors';
import { useGameStore } from '../stores/game';
import StartPage from '../pages/StartPage.vue';
import MigrationPage from '../pages/MigrationPage.vue';
import FollowupDashboard from '../pages/FollowupDashboard.vue';
import PatientPage from '../pages/PatientPage.vue';
import ReviewPage from '../pages/ReviewPage.vue';
import MedicationPage from '../pages/MedicationPage.vue';
import ForumPage from '../pages/ForumPage.vue';
import ArchivePage from '../pages/ArchivePage.vue';
import ComparePage from '../pages/ComparePage.vue';
import ExperimentPage from '../pages/ExperimentPage.vue';
import SlicesPage from '../pages/SlicesPage.vue';
import TrailObjectionPage from '../pages/TrailObjectionPage.vue';
import AudioConsolePage from '../pages/AudioConsolePage.vue';
import SurgeryPage from '../pages/SurgeryPage.vue';
import NextHandoverPage from '../pages/NextHandoverPage.vue';
import EndingPage from '../pages/EndingPage.vue';
import DebriefPage from '../pages/DebriefPage.vue';

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'start', component: StartPage, meta: { layout: 'none', trail: false } },
    {
      path: '/migration',
      name: 'migration',
      component: MigrationPage,
      meta: { layout: 'hospital', address: 'intra.chengwan/migration', trail: false },
    },
    {
      path: '/followup',
      name: 'followup',
      component: FollowupDashboard,
      meta: { layout: 'hospital', address: 'intra.chengwan/followup' },
    },
    {
      path: '/followup/patient/:id',
      name: 'patient',
      component: PatientPage,
      meta: { layout: 'hospital', address: 'intra.chengwan/followup/patient' },
    },
    {
      path: '/followup/review/:id',
      name: 'review',
      component: ReviewPage,
      meta: { layout: 'hospital', address: 'intra.chengwan/followup/review' },
    },
    {
      path: '/medication',
      name: 'medication',
      component: MedicationPage,
      meta: { layout: 'hospital', address: 'intra.chengwan/medication' },
    },
    {
      path: '/forum',
      name: 'forum',
      component: ForumPage,
      meta: { layout: 'forum', address: 'bbs.chengwan.help' },
    },
    {
      path: '/archive',
      name: 'archive',
      component: ArchivePage,
      meta: { layout: 'archive', address: 'archive.chengwan.local' },
    },
    {
      path: '/compare',
      name: 'compare',
      component: ComparePage,
      meta: { layout: 'lab', address: 'lab.chengwan/compare' },
    },
    {
      path: '/lab/experiment',
      name: 'experiment',
      component: ExperimentPage,
      meta: { layout: 'lab', address: 'lab.chengwan/experiment' },
    },
    {
      path: '/lab/slices',
      name: 'slices',
      component: SlicesPage,
      meta: { layout: 'lab', address: 'lab.chengwan/slices' },
    },
    {
      path: '/trail',
      name: 'trail',
      component: TrailObjectionPage,
      meta: { layout: 'lab', address: 'lab.chengwan/trail' },
    },
    {
      path: '/audio/channel-03',
      name: 'audioConsole',
      component: AudioConsolePage,
      meta: { layout: 'lab', address: 'lab.chengwan/audio/channel-03' },
    },
    {
      path: '/lab/surgery',
      name: 'surgery',
      component: SurgeryPage,
      meta: { layout: 'lab', address: 'lab.chengwan/surgery' },
    },
    {
      path: '/handover/next',
      name: 'nextHandover',
      component: NextHandoverPage,
      meta: { layout: 'hospital', address: 'intra.chengwan/handover/next' },
    },
    {
      path: '/ending/:endingId',
      name: 'ending',
      component: EndingPage,
      meta: { layout: 'plain', address: '' },
    },
    {
      path: '/debrief',
      name: 'debrief',
      component: DebriefPage,
      meta: { layout: 'plain', address: '' },
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  // 跳转重置滚动（实机排查 2026-09-15）：不重置时上一页的 scrollY 会带到新页，
  // 把首屏标题滚进 sticky 顶栏后面，造成用户截图中的叠压；后退仍恢复原位。
  scrollBehavior(to, _from, savedPosition) {
    if (savedPosition) return savedPosition;
    if (to.hash) return { el: to.hash, top: 96, behavior: 'smooth' };
    return { top: 0 };
  },
});

router.beforeEach((to) => {
  const store = useGameStore();
  if (to.name === 'start' || to.name === 'migration') return true;
  if (to.name === 'ending') {
    if (store.state.ending !== String(to.params.endingId)) return { path: store.homeRoute };
    return true;
  }
  if (!pageAvailable(store.state, String(to.name))) {
    return { path: store.homeRoute };
  }
  if (to.name === 'followup') void store.ensureSnapshotLoaded();
  return true;
});

router.afterEach((to) => {
  if (to.name !== 'start') {
    useGameStore().setLastRoute(to.fullPath);
  }
});

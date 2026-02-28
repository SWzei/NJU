import fs from 'fs';
import path from 'path';

const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:4100/api';
const smokeHost = process.env.SMOKE_HOST || '127.0.0.1';
const smokePort = Number(process.env.SMOKE_PORT || 4100);

await import('../src/scripts/initDb.js');
const { default: app } = await import('../src/app.js');

const server = await new Promise((resolve, reject) => {
  const instance = app.listen(smokePort, smokeHost, () => resolve(instance));
  instance.once('error', reject);
});

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function request(method, urlPath, { token, json, form, expectedStatus = 200 } = {}) {
  const headers = {};
  let body;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(json);
  } else if (form !== undefined) {
    body = form;
  }

  const res = await fetch(`${base}${urlPath}`, {
    method,
    headers,
    body
  });

  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await res.json() : await res.text();
  if (res.status !== expectedStatus) {
    throw new Error(`${method} ${urlPath} expected ${expectedStatus}, got ${res.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

try {
  const adminLogin = await request('POST', '/auth/login', {
    json: {
      credential: 'A0000000',
      password: 'Admin@123'
    },
    expectedStatus: 200
  });
  const adminToken = adminLogin.token;
  assert(adminToken, 'Admin token missing');

  const suffix = Date.now();
  const studentNumber = `M${String(suffix).slice(-7)}`;
  const register = await request('POST', '/auth/register', {
    json: {
      studentNumber,
      displayName: `测试成员${String(suffix).slice(-4)}`,
      password: 'Member@123',
      email: `m${suffix}@example.com`
    },
    expectedStatus: 201
  });
  const memberToken = register.token;
  assert(memberToken, 'Member token missing after register');

  await request('GET', '/profiles/me', { token: memberToken, expectedStatus: 200 });
  await request('PUT', '/profiles/me', {
    token: memberToken,
    json: {
      displayName: '测试成员-更新',
      academy: '计算机学院',
      major: '软件工程',
      bio: '烟测简介',
      hobbies: '钢琴, 阅读',
      pianoInterests: '即兴伴奏',
      wechatAccount: 'linquan_test',
      phone: '18800001111'
    },
    expectedStatus: 200
  });

  const logoPath = path.resolve(process.cwd(), '../frontend/public/photos/club/林泉社徽.jpg');
  const imageBuffer = fs.readFileSync(logoPath);

  const avatarForm = new FormData();
  avatarForm.append('avatar', new Blob([imageBuffer], { type: 'image/jpeg' }), 'avatar.jpg');
  await request('POST', '/profiles/me/avatar', {
    token: memberToken,
    form: avatarForm,
    expectedStatus: 201
  });

  const photoForm = new FormData();
  photoForm.append('photo', new Blob([imageBuffer], { type: 'image/jpeg' }), 'photo.jpg');
  await request('POST', '/profiles/me/photo', {
    token: memberToken,
    form: photoForm,
    expectedStatus: 201
  });

  const profileAfterUpload = await request('GET', '/profiles/me', {
    token: memberToken,
    expectedStatus: 200
  });
  assert(profileAfterUpload.displayName === '测试成员-更新', 'Profile displayName not saved');
  assert(profileAfterUpload.avatarUrl, 'Avatar URL not saved');
  assert(profileAfterUpload.photoUrl, 'Photo URL not saved');

  const slotsRes = await request('GET', '/scheduling/slots', {
    token: memberToken,
    expectedStatus: 200
  });
  assert(Array.isArray(slotsRes.items) && slotsRes.items.length > 0, 'Scheduling slots empty');
  const slotIds = slotsRes.items.slice(0, 5).map((item) => item.id);
  await request('POST', '/scheduling/preferences', {
    token: memberToken,
    json: {
      semesterId: slotsRes.semesterId,
      slotIds
    },
    expectedStatus: 200
  });

  await request('POST', '/admin/scheduling/run', {
    token: adminToken,
    json: {
      semesterId: slotsRes.semesterId
    },
    expectedStatus: 201
  });
  const proposed = await request('GET', `/admin/scheduling/proposed?semesterId=${slotsRes.semesterId}`, {
    token: adminToken,
    expectedStatus: 200
  });
  assert(Array.isArray(proposed.assignments), 'Proposed assignments missing');

  await request('POST', '/admin/activities', {
    token: adminToken,
    json: {
      title: '烟测活动',
      content: '用于自动化测试的活动内容',
      eventTime: '2026-03-01T18:00:00',
      location: '大活324'
    },
    expectedStatus: 201
  });

  await request('POST', '/admin/announcements', {
    token: adminToken,
    json: {
      title: '烟测公告',
      content: '用于自动化测试的公告内容'
    },
    expectedStatus: 201
  });

  const activities = await request('GET', '/activities', { expectedStatus: 200 });
  assert(Array.isArray(activities.items), 'Activities response invalid');
  const announcements = await request('GET', '/announcements', { expectedStatus: 200 });
  assert(Array.isArray(announcements.items), 'Announcements response invalid');

  const concertCreateForm = new FormData();
  concertCreateForm.append('title', `烟测音乐会-${suffix}`);
  concertCreateForm.append('description', '烟测描述');
  concertCreateForm.append('announcement', '烟测公告');
  concertCreateForm.append('applicationDeadline', '2026-03-10T12:00:00');
  concertCreateForm.append('status', 'open');
  concertCreateForm.append('attachmentFile', new Blob([imageBuffer], { type: 'image/jpeg' }), 'poster.jpg');
  const createdConcert = await request('POST', '/admin/concerts', {
    token: adminToken,
    form: concertCreateForm,
    expectedStatus: 201
  });
  assert(createdConcert.id, 'Concert creation failed');
  const concertId = createdConcert.id;

  const concerts = await request('GET', '/concerts', { token: memberToken, expectedStatus: 200 });
  assert((concerts.items || []).some((item) => item.id === concertId), 'Created concert not visible to member');

  const applyForm = new FormData();
  applyForm.append('applicantName', '测试成员-更新');
  applyForm.append('applicantStudentNumber', studentNumber);
  applyForm.append('pieceZh', '久石让：人生的旋转木马');
  applyForm.append('pieceEn', 'Joe Hisaishi: Merry-Go-Round of Life');
  applyForm.append('durationMin', '6');
  applyForm.append('contactQq', '12345678');
  applyForm.append('scoreFile', new Blob([Buffer.from('fake score content')], { type: 'text/plain' }), 'score.txt');
  await request('POST', `/concerts/${concertId}/applications`, {
    token: memberToken,
    form: applyForm,
    expectedStatus: 201
  });

  const applyLegacyForm = new FormData();
  applyLegacyForm.append('applicantStudentNumber', studentNumber);
  applyLegacyForm.append('pieceTitle', '李斯特：b小调奏鸣曲');
  applyLegacyForm.append('composer', 'Liszt: Sonata in B minor, S.178');
  applyLegacyForm.append('duration', '8');
  applyLegacyForm.append('qq', '87654321');
  await request('POST', `/concerts/${concertId}/applications`, {
    token: memberToken,
    form: applyLegacyForm,
    expectedStatus: 201
  });

  const myApp = await request('GET', `/concerts/${concertId}/my-application`, {
    token: memberToken,
    expectedStatus: 200
  });
  assert(myApp.item && myApp.item.applicantStudentNumber === studentNumber, 'My application query failed');

  const appList = await request('GET', `/admin/concerts/${concertId}/applications`, {
    token: adminToken,
    expectedStatus: 200
  });
  assert(Array.isArray(appList.items) && appList.items.length > 0, 'Admin applications list empty');

  await request('GET', `/admin/concerts/${concertId}/applications/export`, {
    token: adminToken,
    expectedStatus: 200
  });

  const gallery = await request('GET', '/gallery', { expectedStatus: 200 });
  assert(Array.isArray(gallery.items), 'Gallery response invalid');

  const adminGallery = await request('GET', '/admin/gallery', {
    token: adminToken,
    expectedStatus: 200
  });
  assert(Array.isArray(adminGallery.items), 'Admin gallery response invalid');

  console.log('SMOKE TEST PASSED');
} finally {
  await new Promise((resolve, reject) => {
    server.close((err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

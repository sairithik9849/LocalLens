import { admin, blog, users } from '@/mongoConfig/mongoCollections.js';
import { ObjectId } from 'mongodb';

const getInfoByUid = async (uid) => {
  if (!uid) throw 'You must provide a UID';

  const adminCollection = await users();
  const adminData = await adminCollection.findOne({ _id: uid });

  if (!adminData) throw 'No user found with the provided UID';

  return adminData;
}

const getInfoByid = async (uid) => {
  if (!uid) throw 'You must provide a UID';

  const adminCollection = await users();
  const adminData = await adminCollection.findOne({ firebaseUid: uid });

  if (!adminData) throw 'No user found with the provided UID';

  return adminData;
}

export const isUserAdmin = async (uid) => {
    if (!uid) throw 'You must provide a UID';

    const adminCollection = await users();
    const userData = await adminCollection.findOne({ firebaseUid: uid });

    if (!userData) throw 'No user found with the provided UID';

    if (userData.role && userData.role === 'admin') {
        return true;
    } else {
        return false;
    }
}


export const reportBlog = async (blogId, reason, reportedByUid) => {
    if (!blogId) throw 'You must provide a blog ID';
    if (!reason) throw 'You must provide a reason for reporting';
    if (!reportedByUid) throw 'You must provide the UID of the reporter';

    const blogCollection = await blog();
    const usersCollection = await users();

    const blogData = await blogCollection.findOne({ _id: new ObjectId(blogId) });
    if (!blogData) throw 'No blog found with the provided ID';

    const reporterData = await usersCollection.findOne({ firebaseUid: reportedByUid });
    if (!reporterData) throw 'No user found with the provided reporter UID';

    const reportEntry = {
        _id: new ObjectId(),
        blogId: blogId,
        reason: reason,
        reportedBy: new ObjectId(reporterData._id),
        reportedAt: new Date()
    };

    const adminCollection = await admin();
    const updateInfo = await adminCollection.insertOne(reportEntry);
    if (updateInfo.insertedCount === 0) throw 'Could not report the blog';



    return { reported: true };
}

export const getPageOfReports = async (page = 1, pageSize = 10, uid) => {
  if (!await isUserAdmin(uid)) {
    throw new Error('Unauthorized');
  }

  const blogCollection = await blog();
  const adminCollection = await admin();

  const skips = pageSize * (page - 1);

  const reportsList = await adminCollection.find({}).toArray();

  const filtered = [];

  for (const report of reportsList) {
    let blogId = report.blogId;
    if (!blogId) continue;

    if (typeof blogId === 'string' && ObjectId.isValid(blogId)) {
      blogId = new ObjectId(blogId);
    }

    const reporter = await getInfoByUid(report.reportedBy)

    console.log(reporter)

    report.reporterEmail = reporter.email;

    const blogExists = await blogCollection.findOne({ _id: blogId });
    if (blogExists) {
        const reporteeEmail = await getInfoByid(blogExists.postedBy)
        report.reporteeEmail = reporteeEmail.email
        report.title = blogExists.title
        report.body = blogExists.body
        report.postedBy = blogExists.postedBy
        report.postedOn = blogExists.postedOn
        report.location = blogExists.location
        filtered.push(report);
    }
  }

  return filtered.slice(skips, skips + pageSize);
};



export const getPageOfUsers = async (page = 1, pageSize = 10, uid) => {
  if (!isUserAdmin(uid)) {
    throw new Error('Unauthorized');
  }

  const userCollection = await users();

  const skips = pageSize * (page - 1);

  const userList = await userCollection
    .find({})
    .skip(skips)
    .limit(pageSize)
    .toArray();


  return userList;
};




export const approveReport = async (reportId) => {
    if (!reportId) throw 'You must provide a report ID';

    const adminCollection = await admin();

    const deleteInfo = await adminCollection.deleteOne({ _id: new ObjectId(reportId) });
    if (deleteInfo.deletedCount === 0) throw 'Could not approve the report';

    return { approved: true };
}

export const deletePostByReport = async (blogId, uid) => {
    if (!blogId) throw 'You must provide a blog ID';
    if (!uid) throw 'You must provide a UID';
    
    const isAdmin = await isUserAdmin(uid);
    if (!isAdmin) throw 'User is not authorized to delete posts';

    const blogCollection = await blog();
    const adminCollection = await admin();

    const deleteInfo = await blogCollection.deleteOne({ _id: new ObjectId(blogId) });
    if (deleteInfo.deletedCount === 0) throw 'Could not delete the blog post';

    const deletedReports = await adminCollection.deleteMany({blogId: blogId})

    return { deleted: true };
}

export const ignoreReport = async (reportId, uid) => {
    if (!reportId) throw new Error('You must provide a reportId');
    if (!uid) throw new Error('You must provide a UID');

    const isAdmin = await isUserAdmin(uid);
    if (!isAdmin) throw new Error('User is not authorized to delete posts');

    const adminCollection = await admin();

    const deleteInfo = await adminCollection.deleteOne({ _id: new ObjectId(reportId) });
    if (deleteInfo.deletedCount === 0) throw new Error('Could not delete');

    return { deleted: true };
};


export const banUser = async (userId, uid) => {
    if (!reportId) throw new Error('You must provide a reportId');
    if (!uid) throw new Error('You must provide a UID');

    const isAdmin = await isUserAdmin(uid);
    if (!isAdmin) throw new Error('User is not authorized to delete posts');

    const usersCollection = await users();

    const updated = await usersCollection.findOneAndUpdate({_id: userId}, {})


}
import { after } from "node:test";
import { blog , users } from "@/mongoConfig/mongoCollections.js";
import helpers from './helpers.js';
import { ObjectId } from 'mongodb';

async function getLocationByUid(uid) {
  const userCollection = await users();

  const user = await userCollection.findOne({firebaseUid: uid});

  if (!user) {
    throw new Error('User not found');
  }

  console.log(user)
  return user.profile.pincode;


}

async function getNameByUid(uid) {
  const userCollection = await users();

  const user = await userCollection.findOne({firebaseUid: uid});

  if (!user) {
    throw new Error('User not found');
  }

  const result = {
    firstName: user.firstName,
    lastName: user.lastName
  }

  return result;


}


function getCurDate() {
  const now = new Date();

  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day   = String(now.getDate()).padStart(2, '0');
  const year  = now.getFullYear();

  return `${month}/${day}/${year}`;
}

export const createBlog = async (
  title,
  body,
  postedBy
) => {

  if(title == null || body == null || postedBy == null){
    throw new Error('All input parameters must have valid inputs');

  }

  let curDate = getCurDate();

  let location = await getLocationByUid(postedBy);
  console.log(location)

  let blogCollection = await blog();
  let blogPost = {
    title,
    body,
    postedBy: postedBy,
    postedOn: curDate,
    comments:[],
    likes: [postedBy],
    location
  }

  let newCollection = await blogCollection.insertOne(blogPost);
  let outputId = await blogCollection.findOne({_id: newCollection.insertedId});

  let names = await getNameByUid(postedBy);

  return {
    _id: outputId._id.toString(),
    title: outputId.title,
    body: outputId.body,
    postedBy: outputId.postedBy,
    postedOn: outputId.postedOn,
    comments: outputId.comments,
    likes: outputId.likes,
    location: outputId.location,
    firstName: names.firstName,
    lastName: names.lastName
  };
  


};

export const deleteBlog = async (blogId, userId) => {
  const blogCollection = await blog();
  if(typeof blogId != 'string' || blogId.trim() == '' || !ObjectId.isValid(blogId) || blogId == undefined || blogId == null){
    throw new Error('Input must be valid string of length greater than zero containing more than spaces.')
  }
  blogId = blogId.trim();

  const blogs = await blogCollection.findOne({ _id: new ObjectId(blogId) });

  console.log(blogs)
  if(userId != blogs.postedBy){
    throw new Error('Cannot delete other users blogs')
  }
  const result = await blogCollection.deleteOne({ _id: new ObjectId(blogId) });

  if (result.deletedCount === 0) {
    throw `Blog that corresponds to the given id not found`;

  }
  return true;
};

export const getBlogById = async (blogId) => {
  const blogCollection = await blog();


  if(typeof blogId != 'string' || blogId.trim() == '' || !ObjectId.isValid(blogId) || blogId == undefined || blogId == null){
    throw new Error('Input must be valid string of length greater than zero containing more than spaces.')
  }
  blogId = blogId.trim();

  const blogs = await blogCollection.findOne({_id: new ObjectId(blogId)});

  if (!blogs) {
    throw `Blog that corresponds to the given id not found`;

  }

  blogs._id = blogs._id.toString();

  
  return blogs;




};

export const toggleLike = async (blogId, user) => {
  const blogCollection = await blog();

  if (typeof blogId != 'string' || blogId.trim() === '' || !ObjectId.isValid(blogId) || blogId === undefined || blogId === null) {
    throw new Error('Input must be a valid string of length greater than zero containing more than spaces.');
  }
  blogId = blogId.trim();

  const blogSelection = await blogCollection.findOne({ _id: new ObjectId(blogId) });
  if (!blogSelection) {
    throw new Error('Blog that corresponds to the given id not found');
  }

  const userLiked = blogSelection.likes.includes(user);
  
  let result;
  if (userLiked) {
    result = await blogCollection.updateOne(
      { _id: new ObjectId(blogId) },
      { $pull: { likes: user } },
      { returnDocument: 'after' }
    );
  } else {
    result = await blogCollection.updateOne(
      { _id: new ObjectId(blogId) },
      { $push: { likes: user } },
      { returnDocument: 'after' }
    );
  }
  
  return result;
};


export const addComment = async (blogId, comment, user) => {
  const blogCollection = await blog();


  if(typeof blogId != 'string' || blogId.trim() == '' || !ObjectId.isValid(blogId) || blogId == undefined || blogId == null){
    throw new Error('Input must be valid string of length greater than zero containing more than spaces.')
  }
  blogId = blogId.trim();

  comment = helpers.validate('comment', comment);

  const commentObj = {
    _id: new ObjectId(),
    postedBy: user,
    postedOn: getCurDate(),         
    comment,
    replies: [],                          
  };


  const newObj = {
    _id: commentObj._id.toString(),
    postedBy: commentObj.postedBy,
    postedOn: commentObj.postedOn,
    comment: commentObj.comment,
    replies: commentObj.replies,
  }
  let names = await getNameByUid(user);
  newObj.firstName = names.firstName;
  newObj.lastName = names.lastName;


  const result = await blogCollection.updateOne(
    { _id: new ObjectId(blogId) },      
    { $push: { comments: commentObj } },
    {
      returnDocument: 'after',
    }
  );

  if (!result) {
    throw `Blog that corresponds to the given id not found`;

  }

  
  return newObj;

};

export const getCommentByid = async (blogId, commentId) => {
  const blogCollection = await blog();
  if(typeof blogId != 'string' || blogId.trim() == '' || !ObjectId.isValid(blogId) || blogId == undefined || blogId == null){
    throw new Error('Input must be valid string of length greater than zero containing more than spaces.')
  }
  blogId = blogId.trim();

  const blogData = await blogCollection.findOne({_id: new ObjectId(blogId)});

  if (!blogData) {
    throw `Blog that corresponds to the given id not found`;

  }

  const comment = blogData.comments.find(c => c._id.toString() === commentId);

  if (!comment) {
    throw `Comment that corresponds to the given id not found`;

  }

  comment._id = comment._id.toString();

  return comment;

};

export const patchComment = async (blogId, commentId, comment, user) => {
  console.log(blogId, commentId, comment, user);
  const blogCollection = await blog();
  
  if(typeof blogId != 'string' || blogId.trim() == '' || !ObjectId.isValid(blogId) || blogId == undefined || blogId == null){
    throw new Error('Input must be valid string of length greater than zero containing more than spaces.')
  }
  blogId = blogId.trim();

  comment = helpers.validate('comment', comment);

  const result = await blogCollection.findOneAndUpdate(
    { 
      _id: new ObjectId(blogId), 
      'comments._id': new ObjectId(commentId),
      'comments.postedBy': user
    },
    { 
      $set: { 'comments.$.comment': comment } 
    },
    { returnOriginal: false }
  );

  if (!result) {
    throw `Blog that corresponds to the given id not found`;

  }
  const doc = await blogCollection.findOne(
    { _id: new ObjectId(blogId), 'comments._id': new ObjectId(commentId) },
    { projection: { comments: { $elemMatch: { _id: new ObjectId(commentId) } }, _id: 0 } }
  );

  let names = await getNameByUid(doc.comments[0].postedBy);
  doc.comments[0].firstName = names.firstName;
  doc.comments[0].lastName = names.lastName;

  for (let i = 0; i < doc.comments[0].replies.length; i++) {
    let replyNames = await getNameByUid(doc.comments[0].replies[i].postedBy);
    doc.comments[0].replies[i].firstName = replyNames.firstName;
    doc.comments[0].replies[i].lastName = replyNames.lastName;
  }

  return doc && doc.comments && doc.comments[0] ? doc.comments[0] : null;


};


export const addReply = async (blogId, commentId, comment, user) => {
  const blogCollection = await blog();
  
  if(typeof blogId != 'string' || blogId.trim() == '' || !ObjectId.isValid(blogId) || blogId == undefined || blogId == null){
    throw new Error('Input must be valid string of length greater than zero containing more than spaces.')
  }
  blogId = blogId.trim();

  comment = helpers.validate('comment', comment);

  const commentObj = {
    _id: new ObjectId(),
    postedBy: user,
    postedOn: getCurDate(),         
    comment,
  };

  const newObj = {
    _id: commentObj._id.toString(),
    postedBy: commentObj.postedBy,
    postedOn: commentObj.postedOn,
    comment: commentObj.comment,
    replies: commentObj.replies,
  }
  let names = await getNameByUid(user);
  newObj.firstName = names.firstName;
  newObj.lastName = names.lastName;

  const result = await blogCollection.findOneAndUpdate(
    { 
      _id: new ObjectId(blogId), 
      'comments._id': new ObjectId(commentId) 
    },
    { 
      $push: { 'comments.$.replies': commentObj } 
    },
    { returnOriginal: false }
  );


  if (!result) {
    throw `Blog that corresponds to the given id not found`;

  }
  
  return newObj;

};

export const deleteReply = async (blogId, commentId, replyId, user) => {
  const blogCollection = await blog();
  
  if(typeof blogId != 'string' || blogId.trim() == '' || !ObjectId.isValid(blogId) || blogId == undefined || blogId == null){
    throw new Error('Input must be valid string of length greater than zero containing more than spaces.')
  }
  blogId = blogId.trim();



  const result = await blogCollection.findOneAndUpdate(
    { 
      _id: new ObjectId(blogId), 
      'comments._id': new ObjectId(commentId) 
    },
    { 
      $pull: { 'comments.$.replies': { _id: new ObjectId(replyId) } } 
    },
    { returnOriginal: false }
  );

  if (!result) {
    throw `Reply that corresponds to the given id not found`;

  }
  
  return result;

};

export const patchReply = async (blogId, commentId, replyId, comment, user) => {
  console.log(blogId, commentId, replyId, comment, user);
  const blogCollection = await blog();
  
  if(typeof blogId != 'string' || blogId.trim() == '' || !ObjectId.isValid(blogId) || blogId == undefined || blogId == null){
    throw new Error('Input must be valid string of length greater than zero containing more than spaces.')
  }
  blogId = blogId.trim();

  comment = helpers.validate('comment', comment);

  const result = await blogCollection.findOneAndUpdate(
    { 
      _id: new ObjectId(blogId), 
      'comments._id': new ObjectId(commentId),
      'comments.replies._id': new ObjectId(replyId),
      'comments.replies.postedBy': user
    },
    { 
      $set: { 'comments.$[].replies.$[reply].comment': comment } 
    },
    { 
      arrayFilters: [ { 'reply._id': new ObjectId(replyId) } ],
      returnOriginal: false 
    }
  );

  if (!result) {
    throw `Blog that corresponds to the given id not found`;

  }
  
  let final = await blogCollection.aggregate([
    { $match: { "comments.replies._id": new ObjectId(replyId) } },
    { $unwind: "$comments" },
    { $unwind: "$comments.replies" },
    { $match: { "comments.replies._id": new ObjectId(replyId) } },
    { $project: {
        _id: 0,
        postId: "$_id",
        commentId: "$comments._id",
        reply: "$comments.replies"
    }}
  ]).toArray();

  let names = await getNameByUid(final[0].reply.postedBy);
  final[0].reply.firstName = names.firstName;
  final[0].reply.lastName = names.lastName;


  return final[0].reply;
};


export const deleteComment = async (blogId, commentId) => {
  const blogCollection = await blog();


  if(typeof blogId != 'string' || blogId.trim() == '' || !ObjectId.isValid(blogId) || blogId == undefined || blogId == null){
    throw new Error('Input must be valid string of length greater than zero containing more than spaces.')
  }
  blogId = blogId.trim();
    
    const result = await blogCollection.updateOne(
      { _id: new ObjectId(blogId) },
      { $pull: { comments: { _id: new ObjectId(commentId) } }},
      {
        returnDocument: 'after',
      }
    );

  if (!result) {
    throw `Blog that corresponds to the given id not found`;

  }
  
  return result;


};




export const getPageOfBlogs = async (page, uid) => {
  const blogCollection = await blog();

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  let location = await getLocationByUid(uid);

  let blogs = await blogCollection.find({ location }).toArray();
  if (blogs.length === 0) return [];

  blogs = blogs
    .map((b) => {
      b._id = b._id.toString();
      b.postedDateObj = new Date(b.postedOn);
      return b;
    })
    .filter((b) => b.postedDateObj >= oneWeekAgo);

  blogs.sort((a, b) => b.likes.length - a.likes.length);

  const pageSize = 10;
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;

  const pageBlogs = blogs.slice(startIndex, endIndex);

  const collectPostedByInstances = (node, instances = []) => {
    if (Array.isArray(node)) {
      for (const item of node) collectPostedByInstances(item, instances);
      return instances;
    }
    if (node && typeof node === "object") {
      for (const key of Object.keys(node)) {
        if (key === "postedBy" && node[key] != null) {
          instances.push({ parent: node, uid: node[key] });
        }
        collectPostedByInstances(node[key], instances);
      }
    }
    return instances;
  };

  const instances = [];
  for (const b of pageBlogs) {
    collectPostedByInstances(b, instances);
  }

  if (instances.length === 0) {
    return pageBlogs;
  }

  const uniqueUids = [...new Set(instances.map((i) => String(i.uid)))];
  const uidToName = new Map();

  for (const u of uniqueUids) {
    try {
      const nameObj = await getNameByUid(u);
      if (nameObj && (nameObj.firstName || nameObj.lastName)) {
        uidToName.set(u, {
          firstName: nameObj.firstName ?? null,
          lastName: nameObj.lastName ?? null,
        });
      } else {
        uidToName.set(u, { firstName: null, lastName: null });
      }
    } catch (err) {
      uidToName.set(u, { firstName: null, lastName: null });
    }
  }

  for (const inst of instances) {
    const u = String(inst.uid);
    const names = uidToName.get(u) || { firstName: null, lastName: null };
    inst.parent.firstName = names.firstName;
    inst.parent.lastName = names.lastName;
  }

  return pageBlogs;
};

export const postBlog = async (title, body, blogId, username) => {
  console.log(title, body, blogId, username);
  title = helpers.validate('title', title);
  body = helpers.validate('body', body);

  if(typeof blogId != 'string' || blogId.trim() == '' || !ObjectId.isValid(blogId) || blogId == undefined || blogId == null){
    throw new Error('Input must be valid string of length greater than zero containing more than spaces.')
  }
  blogId = blogId.trim();

  const blogCollection = await blog();

  const blogs = await blogCollection.findOne({ _id: new ObjectId(blogId) });

  console.log(blogs)
  if(username != blogs.postedBy){
    throw new Error('Cannot edit other users blogs')
  } 
  const result = await blogCollection.findOne({ _id: new ObjectId(blogId) });

  console.log(result)

  let newTitle = title || result.title;
  let newBody = body || result.body;
  const final = await blogCollection.findOneAndUpdate(
  { _id: new ObjectId(blogId) },
  { $set: { title: newTitle, body: newBody} },
  {
    returnDocument: 'after',
  }
  );
  if (!final) {
    throw `Blog that corresponds to the given id not found`;

  }
  
  return final;
};

export const patchBlog = async (title, body, blogId, username) => {
  title = helpers.validate('title', title);
  body = helpers.validate('body', body);  
  


  if(typeof blogId != 'string' || blogId.trim() == '' || !ObjectId.isValid(blogId) || blogId == undefined || blogId == null){
    throw new Error('Input must be valid string of length greater than zero containing more than spaces.')
  }
  blogId = blogId.trim();

  const blogCollection = await blog();

  const blogs = await blogCollection.findOne({ _id: new ObjectId(blogId) });

  console.log(blogs)
  if(username != blogs.postedBy){
    throw new Error('Cannot edit other users blogs')
  }


  let curDate = getCurDate();

  const result = await blogCollection.findOne({ _id: new ObjectId(blogId) });

  console.log(result)

  let newTitle = title || result.title;
  let newBody = body || result.body;


  const final = await blogCollection.findOneAndUpdate(
  { _id: new ObjectId(blogId) },
  { $set: { title: newTitle, body: newBody, updatedOn: curDate} },
  {
    returnDocument: 'after',
  }
  );




  if (!final) {
    throw `Blog that corresponds to the given id not found`;

  }
  
  return final;




};

export const searchPosts = async (query, userId) => {
  const blogCollection = await blog();

  let location = await getLocationByUid(userId);

  const regex = new RegExp(query, 'i');

  let blogs = await blogCollection.find({ 
    location,
    $or: [
      { title: { $regex: regex } },
      { body: { $regex: regex } }
    ]

   }).toArray();

  blogs = blogs.map((b) => {
    b._id = b._id.toString();
    return b;
  });

  for (let blog of blogs) {
    let names = await getNameByUid(blog.postedBy);
    blog.firstName = names.firstName;
    blog.lastName = names.lastName;
    for (let i = 0; i < blog.comments.length; i++) {
      let commentNames = await getNameByUid(blog.comments[i].postedBy);
      blog.comments[i].firstName = commentNames.firstName;
      blog.comments[i].lastName = commentNames.lastName;
      for (let j = 0; j < blog.comments[i].replies.length; j++) {
        let replyNames = await getNameByUid(blog.comments[i].replies[j].postedBy);
        blog.comments[i].replies[j].firstName = replyNames.firstName;
        blog.comments[i].replies[j].lastName = replyNames.lastName;
      }
  }}

  return blogs;
};